import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { MaquinaStatusPelada } from '../../dominio/pelada/maquina-status-pelada';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { AdicionarParticipanteDto } from './dto/adicionar-participante.dto';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';

@Injectable()
export class ParticipantesService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    @InjectRepository(JogadorEntity)
    private readonly jogadores: Repository<JogadorEntity>,
    @InjectRepository(ParticipantePeladaEntity)
    private readonly participantes: Repository<ParticipantePeladaEntity>,
    @InjectRepository(FilaJogadorEntity)
    private readonly fila: Repository<FilaJogadorEntity>,
    @InjectRepository(JogadorTimeEntity)
    private readonly jogadoresTime: Repository<JogadorTimeEntity>,
    private readonly fonteDados: DataSource,
  ) {}
  async adicionar(
    usuarioId: string,
    peladaId: string,
    dto: AdicionarParticipanteDto,
  ): Promise<ParticipantePeladaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    if (
      !(await this.jogadores.findOne({
        where: { id: dto.jogadorId, usuarioId },
      }))
    )
      throw new NotFoundException('Jogador nao encontrado');
    if (
      await this.participantes.findOne({
        where: { peladaId, jogadorId: dto.jogadorId },
      })
    )
      throw new ErroRegraPelada(
        'PARTICIPANTE_DUPLICADO',
        'Jogador ja participa da pelada',
      );
    if (
      (await this.participantes.count({ where: { peladaId } })) >=
      pelada.configuracao.maximoJogadores
    )
      throw new ErroRegraPelada(
        'MAXIMO_JOGADORES_ATINGIDO',
        'Limite de participantes atingido',
      );
    return this.participantes.save(
      this.participantes.create({
        peladaId,
        jogadorId: dto.jogadorId,
        ehGoleiroFixo: dto.ehGoleiroFixo ?? false,
        status: StatusParticipantePelada.CONFIRMADO,
      }),
    );
  }
  async listar(
    usuarioId: string,
    peladaId: string,
  ): Promise<ParticipantePeladaEntity[]> {
    await this.carregarPelada(usuarioId, peladaId);
    return this.participantes.find({
      where: { peladaId },
      relations: ['jogador'],
      order: { ordemChegada: 'ASC', confirmadoEm: 'ASC' },
    });
  }
  async marcarChegada(
    usuarioId: string,
    peladaId: string,
    id: string,
  ): Promise<ParticipantePeladaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    const p = await this.participantes.findOne({ where: { id, peladaId } });
    if (!p) throw new NotFoundException('Participante nao encontrado');
    const primeiraChegada = p.ordemChegada === null;
    if (primeiraChegada) {
      const ultimo = await this.participantes
        .createQueryBuilder('p')
        .select('COALESCE(MAX(p.ordemChegada), 0)', 'maximo')
        .where('p.peladaId = :peladaId', { peladaId })
        .getRawOne<{ maximo: string }>();
      p.ordemChegada = Number(ultimo?.maximo ?? 0) + 1;
      p.chegadaEm = new Date();
    }
    p.status = StatusParticipantePelada.PRESENTE;
    const salvo = await this.participantes.save(p);

    // Chegou depois que a pelada comecou: entra no fim da fila agora.
    // Sem isto a pessoa ficava PRESENTE mas fora de FilaJogador, e como a
    // rotacao reconstroi a fila a partir de quem ja estava nela, ela nunca
    // entrava em campo — sumia da pelada.
    if (primeiraChegada && pelada.status === StatusPelada.EM_ANDAMENTO) {
      await this.enfileirar(peladaId, salvo);
    }

    return salvo;
  }

  /**
   * Coloca o participante no fim da fila, se ainda nao estiver nela.
   *
   * Goleiro fixo nao entra: pela regra da pelada ele fica no gol e fora da
   * rotacao dos jogadores de linha.
   */
  private async enfileirar(
    peladaId: string,
    participante: ParticipantePeladaEntity,
  ): Promise<void> {
    if (participante.ehGoleiroFixo) return;

    const jaNaFila = await this.fila.findOne({
      where: { peladaId, participanteId: participante.id, ativo: true },
    });
    if (jaNaFila) return;

    const ultima = await this.fila
      .createQueryBuilder('f')
      .select('COALESCE(MAX(f.posicao), 0)', 'maximo')
      .where('f.peladaId = :peladaId AND f.ativo = true', { peladaId })
      .getRawOne<{ maximo: string }>();

    await this.fila.save(
      this.fila.create({
        peladaId,
        participanteId: participante.id,
        posicao: Number(ultima?.maximo ?? 0) + 1,
        ativo: true,
        saiuEm: null,
      }),
    );
  }
  /**
   * Saida temporaria: o jogador para um pouco mas continua na pelada.
   *
   * A vaga no time e guardada — JogadorTime segue ativo. E a diferenca em
   * relacao a desistencia: quem descansa volta para o mesmo time, quem desiste
   * perde a vaga para alguem da fila.
   */
  async pausar(
    usuarioId: string,
    peladaId: string,
    id: string,
  ): Promise<ParticipantePeladaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    const p = await this.buscarParticipante(peladaId, id);

    if (p.status === StatusParticipantePelada.DESISTIU)
      throw new ErroRegraPelada(
        'PARTICIPANTE_DESISTIU',
        'Quem desistiu nao pode voltar a descansar',
      );

    p.status = StatusParticipantePelada.DESCANSANDO;
    return this.participantes.save(p);
  }

  /** Volta de uma pausa, retomando a vaga que ficou guardada. */
  async retornar(
    usuarioId: string,
    peladaId: string,
    id: string,
  ): Promise<ParticipantePeladaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    const p = await this.buscarParticipante(peladaId, id);

    if (p.status === StatusParticipantePelada.DESISTIU)
      throw new ErroRegraPelada(
        'PARTICIPANTE_DESISTIU',
        'Quem desistiu precisa ser adicionado de novo',
      );

    const emTime = await this.jogadoresTime.findOne({
      where: { participanteId: id, ativo: true },
    });
    p.status = emTime
      ? StatusParticipantePelada.JOGANDO
      : StatusParticipantePelada.PRESENTE;

    // Quem voltou e nao tem time entra no fim da fila; quem tem, retoma a vaga.
    const salvo = await this.participantes.save(p);
    if (!emTime && pelada.status === StatusPelada.EM_ANDAMENTO) {
      await this.enfileirar(peladaId, salvo);
    }
    return salvo;
  }

  /**
   * Desistencia: o jogador sai da pelada de vez.
   *
   * Perde a vaga no time e sai da fila, mas o registro permanece — gols,
   * assistencias e pontos ja marcados continuam valendo. O historico da pelada
   * nao pode mentir sobre o que aconteceu.
   */
  async desistir(
    usuarioId: string,
    peladaId: string,
    id: string,
  ): Promise<ParticipantePeladaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    const p = await this.buscarParticipante(peladaId, id);

    p.status = StatusParticipantePelada.DESISTIU;
    const salvo = await this.participantes.save(p);

    await this.jogadoresTime.update(
      { participanteId: id, ativo: true },
      { ativo: false, saiuEm: new Date() },
    );
    await this.fila.update(
      { peladaId, participanteId: id, ativo: true },
      { ativo: false, saiuEm: new Date() },
    );

    return salvo;
  }

  /**
   * Define quem e o goleiro de um time, ou tira o goleiro.
   *
   * So mexe no elenco daquele time: nada entra nem sai da fila. E o caso da
   * pelada sem goleiro fixo, em que o organizador combina na hora quem vai
   * para o gol — e pode trocar a cada partida sem que isso afete a rotacao.
   *
   * `participanteId` nulo deixa o time sem goleiro.
   */
  async definirGoleiro(
    usuarioId: string,
    peladaId: string,
    timeId: string,
    participanteId: string | null,
  ): Promise<JogadorTimeEntity[]> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);

    const elenco = await this.jogadoresTime.find({
      where: { timeId, ativo: true },
    });
    if (elenco.length === 0)
      throw new NotFoundException('Time nao encontrado nesta pelada');

    if (participanteId !== null) {
      const membro = elenco.find((e) => e.participanteId === participanteId);
      if (!membro)
        throw new ErroRegraPelada(
          'JOGADOR_FORA_DO_TIME',
          'So quem esta no time pode ser o goleiro dele',
        );
    }

    for (const membro of elenco) {
      const deveSerGoleiro = membro.participanteId === participanteId;
      if (membro.ehGoleiro !== deveSerGoleiro) {
        await this.jogadoresTime.update(membro.id, {
          ehGoleiro: deveSerGoleiro,
        });
        membro.ehGoleiro = deveSerGoleiro;
      }
    }

    return elenco;
  }

  private async buscarParticipante(
    peladaId: string,
    id: string,
  ): Promise<ParticipantePeladaEntity> {
    const p = await this.participantes.findOne({ where: { id, peladaId } });
    if (!p) throw new NotFoundException('Participante nao encontrado');
    return p;
  }

  async alterarStatus(
    usuarioId: string,
    peladaId: string,
    id: string,
    status: StatusParticipantePelada,
  ): Promise<ParticipantePeladaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    const participante = await this.participantes.findOne({
      where: { id, peladaId },
    });
    if (!participante)
      throw new NotFoundException('Participante nao encontrado');
    participante.status = status;
    return this.participantes.save(participante);
  }
  async remover(
    usuarioId: string,
    peladaId: string,
    id: string,
  ): Promise<void> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    const participante = await this.participantes.findOne({
      where: { id, peladaId },
    });
    if (!participante)
      throw new NotFoundException('Participante nao encontrado');
    await this.participantes.remove(participante);
  }
  /**
   * Reordena a chegada.
   *
   * "Quem chegou" e quem tem ordemChegada preenchida, nao quem esta com status
   * PRESENTE: assim que a partida comeca os participantes viram JOGANDO ou
   * AGUARDANDO e continuam fazendo parte da ordem. Filtrar por status fazia os
   * conjuntos divergirem do que a tela envia e a operacao falhar com 422.
   */
  async reordenar(
    usuarioId: string,
    peladaId: string,
    ids: string[],
  ): Promise<ParticipantePeladaEntity[]> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);

    const chegaram = await this.participantes.find({
      where: { peladaId, ordemChegada: Not(IsNull()) },
    });
    if (
      ids.length !== chegaram.length ||
      new Set(ids).size !== ids.length ||
      chegaram.some((p) => !ids.includes(p.id))
    )
      throw new ErroRegraPelada(
        'ORDEM_CHEGADA_INVALIDA',
        'A ordem deve conter todos os que ja chegaram, uma unica vez',
        { esperado: chegaram.length, recebido: ids.length },
      );

    // Duas fases numa transacao. O indice (peladaId, ordemChegada) e UNIQUE,
    // entao escrever as posicoes finais direto colide: trocar 1 com 2 faz o
    // primeiro UPDATE bater no registro que ainda ocupa o 2. Passamos todos
    // por valores negativos, que nenhum registro valido usa, e so entao
    // aplicamos a ordem definitiva.
    return this.fonteDados.transaction(async (gerenciador) => {
      for (const [indice, id] of ids.entries()) {
        await gerenciador.update(ParticipantePeladaEntity, id, {
          ordemChegada: -(indice + 1),
        });
      }
      for (const [indice, id] of ids.entries()) {
        await gerenciador.update(ParticipantePeladaEntity, id, {
          ordemChegada: indice + 1,
        });
      }
      return gerenciador.find(ParticipantePeladaEntity, {
        where: { peladaId },
        relations: ['jogador'],
        order: { ordemChegada: 'ASC', confirmadoEm: 'ASC' },
      });
    });
  }
  private async carregarPelada(
    usuarioId: string,
    id: string,
  ): Promise<PeladaEntity> {
    const p = await this.peladas.findOne({
      where: { id, organizadorId: usuarioId },
      relations: ['configuracao'],
    });
    if (!p) throw new NotFoundException('Pelada nao encontrada');
    return p;
  }
  private garantirAberta(p: PeladaEntity): void {
    if (MaquinaStatusPelada.estaEncerrada(p.status))
      throw new ErroRegraPelada('PELADA_ENCERRADA', 'Pelada encerrada');
  }
}
