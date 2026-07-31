import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
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
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';

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
    @InjectRepository(PartidaEntity)
    private readonly partidas: Repository<PartidaEntity>,
    @InjectRepository(ParticipacaoPartidaEntity)
    private readonly participacoes: Repository<ParticipacaoPartidaEntity>,
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

    // Saida temporaria nao mexe em nada alem do status: nem no time, nem na
    // fila. Quem so foi beber agua nao perde a vaga que estava ocupando nem a
    // vez que conquistou esperando — e para isso que existe `retornar`.
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

    // Sobe a lista: sem isto fica um buraco na numeracao, e quem esta atras
    // continua vendo a posicao antiga — "sou o quinto" quando ja e o quarto.
    // A saida e definitiva, entao a vez dele passa para quem vem depois.
    await this.compactarFila(peladaId);

    return salvo;
  }

  /**
   * Renumera a fila para 1..n sem buracos.
   *
   * Sobe em ordem crescente de proposito: compactando sempre para baixo, a
   * posicao de destino ja foi liberada pelo passo anterior e o indice unico
   * (pelada_id, posicao) nunca colide no meio do caminho.
   */
  private async compactarFila(peladaId: string): Promise<void> {
    const restantes = await this.fila.find({
      where: { peladaId, ativo: true },
      order: { posicao: 'ASC' },
    });

    for (const [indice, registro] of restantes.entries()) {
      const alvo = indice + 1;
      if (registro.posicao !== alvo) {
        await this.fila.update(registro.id, { posicao: alvo });
      }
    }
  }

  /**
   * Define o goleiro avulso de um lado da partida.
   *
   * O goleiro vem de fora dos elencos e pertence somente a partida atual. Ele
   * continua na fila, na mesma posicao, e nao vira membro permanente do time.
   * `participanteId` nulo remove a escolha avulsa.
   */
  async definirGoleiro(
    usuarioId: string,
    peladaId: string,
    timeId: string,
    participanteId: string | null,
  ): Promise<PartidaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);

    return this.fonteDados.transaction(async (gerenciador) => {
      const partida = await gerenciador.findOne(PartidaEntity, {
        where: {
          peladaId,
          status: In([StatusPartida.AGUARDANDO, StatusPartida.EM_ANDAMENTO]),
        },
        order: { numero: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !partida ||
        (partida.timeCasaId !== timeId && partida.timeVisitanteId !== timeId)
      ) {
        throw new NotFoundException('Time nao encontrado na partida atual');
      }

      const ladoCasa = partida.timeCasaId === timeId;
      const anterior = ladoCasa
        ? partida.goleiroCasaId
        : partida.goleiroVisitanteId;
      if (anterior === participanteId) return partida;

      if (participanteId !== null) {
        const outroLado = ladoCasa
          ? partida.goleiroVisitanteId
          : partida.goleiroCasaId;
        if (outroLado === participanteId) {
          throw new ErroRegraPelada(
            'GOLEIRO_JA_ESCALADO',
            'A mesma pessoa nao pode ocupar os dois gols',
          );
        }

        const participante = await gerenciador.findOne(
          ParticipantePeladaEntity,
          { where: { id: participanteId, peladaId } },
        );
        if (!participante) {
          throw new NotFoundException('Participante nao encontrado');
        }

        const podeJogar =
          participante.ordemChegada !== null &&
          [
            StatusParticipantePelada.PRESENTE,
            StatusParticipantePelada.AGUARDANDO,
          ].includes(participante.status);
        if (!podeJogar) {
          throw new ErroRegraPelada(
            'GOLEIRO_INDISPONIVEL',
            'Escolha alguem presente e disponivel fora da partida',
          );
        }

        const membroAtivo = await gerenciador.findOne(JogadorTimeEntity, {
          where: [
            {
              timeId: partida.timeCasaId,
              participanteId,
              ativo: true,
            },
            {
              timeId: partida.timeVisitanteId,
              participanteId,
              ativo: true,
            },
          ],
        });
        if (membroAtivo) {
          throw new ErroRegraPelada(
            'JOGADOR_JA_EM_CAMPO',
            'O goleiro avulso precisa estar fora da partida',
          );
        }

        const goleiroFixo = await gerenciador.findOne(JogadorTimeEntity, {
          where: { timeId, ehGoleiro: true, ativo: true },
        });
        if (goleiroFixo) {
          throw new ErroRegraPelada(
            'TIME_JA_TEM_GOLEIRO_FIXO',
            'Este time ja possui goleiro fixo',
          );
        }

        if (partida.status === StatusPartida.EM_ANDAMENTO) {
          const participacaoAtiva = await gerenciador.findOne(
            ParticipacaoPartidaEntity,
            {
              where: {
                partidaId: partida.id,
                participanteId,
                saiuEm: IsNull(),
              },
            },
          );
          if (participacaoAtiva) {
            throw new ErroRegraPelada(
              'JOGADOR_JA_EM_CAMPO',
              'O goleiro avulso precisa estar fora da partida',
            );
          }
        }
      }

      if (ladoCasa) partida.goleiroCasaId = participanteId;
      else partida.goleiroVisitanteId = participanteId;
      await gerenciador.save(partida);

      if (partida.status === StatusPartida.EM_ANDAMENTO) {
        await this.sincronizarParticipacaoGoleiro(
          gerenciador,
          partida,
          timeId,
          anterior,
          participanteId,
        );
      }

      return partida;
    });
  }

  private async sincronizarParticipacaoGoleiro(
    gerenciador: EntityManager,
    partida: PartidaEntity,
    timeId: string,
    anterior: string | null,
    proximo: string | null,
  ): Promise<void> {
    const agora = new Date();
    if (anterior) {
      const participacaoAnterior = await gerenciador.findOne(
        ParticipacaoPartidaEntity,
        {
          where: {
            partidaId: partida.id,
            participanteId: anterior,
            saiuEm: IsNull(),
          },
        },
      );
      if (participacaoAnterior) {
        await gerenciador.update(
          ParticipacaoPartidaEntity,
          participacaoAnterior.id,
          { saiuEm: agora },
        );
      }
    }

    if (!proximo) return;

    const existente = await gerenciador.findOne(ParticipacaoPartidaEntity, {
      where: { partidaId: partida.id, participanteId: proximo },
    });
    if (existente) {
      await gerenciador.update(ParticipacaoPartidaEntity, existente.id, {
        timeId,
        ehGoleiro: true,
        saiuEm: null,
      });
      return;
    }

    await gerenciador.save(
      gerenciador.create(ParticipacaoPartidaEntity, {
        partidaId: partida.id,
        participanteId: proximo,
        timeId,
        ehGoleiro: true,
        saiuEm: null,
        minutosJogados: null,
      }),
    );
  }

  /**
   * Troca dois jogadores de lado antes da partida comecar.
   *
   * So vale enquanto ninguem apitou: com a partida em andamento existe
   * ParticipacaoPartida, e mexer no elenco por fora deixaria o registro do jogo
   * mentindo sobre quem jogou onde. Depois de iniciada, a via e a substituicao.
   *
   * Nao mexe na fila: os dois ja estao escalados, so trocam de time. O papel de
   * goleiro fica com o time, nao com a pessoa — quem assume a vaga do goleiro
   * assume o gol.
   */
  async trocarJogadoresDeTime(
    usuarioId: string,
    peladaId: string,
    participanteA: string,
    participanteB: string,
  ): Promise<JogadorTimeEntity[]> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);

    if (participanteA === participanteB)
      throw new ErroRegraPelada(
        'TROCA_INVALIDA',
        'Escolha dois jogadores diferentes',
      );

    const emAndamento = await this.partidas.findOne({
      where: { peladaId, status: StatusPartida.EM_ANDAMENTO },
    });
    if (emAndamento)
      throw new ErroRegraPelada(
        'PARTIDA_JA_INICIADA',
        'A partida ja comecou: use substituicao para trocar jogadores',
      );

    const [a, b] = await Promise.all([
      this.jogadoresTime.findOne({
        where: { participanteId: participanteA, ativo: true },
      }),
      this.jogadoresTime.findOne({
        where: { participanteId: participanteB, ativo: true },
      }),
    ]);
    if (!a || !b)
      throw new ErroRegraPelada(
        'JOGADOR_SEM_TIME',
        'Os dois precisam estar escalados em algum time',
      );
    if (a.timeId === b.timeId)
      throw new ErroRegraPelada('MESMO_TIME', 'Os dois ja estao no mesmo time');

    // O papel de goleiro pertence a vaga: quem vai para o lugar do goleiro
    // assume o gol, e vice-versa.
    const [timeA, goleiroA] = [a.timeId, a.ehGoleiro];
    await this.jogadoresTime.update(a.id, {
      timeId: b.timeId,
      ehGoleiro: b.ehGoleiro,
    });
    await this.jogadoresTime.update(b.id, {
      timeId: timeA,
      ehGoleiro: goleiroA,
    });

    return this.jogadoresTime.find({
      where: [
        { timeId: timeA, ativo: true },
        { timeId: b.timeId, ativo: true },
      ],
    });
  }

  private async buscarParticipante(
    peladaId: string,
    id: string,
  ): Promise<ParticipantePeladaEntity> {
    const p = await this.participantes.findOne({ where: { id, peladaId } });
    if (!p) throw new NotFoundException('Participante nao encontrado');
    return p;
  }

  /**
   * Altera a classificacao do participante sem reescrever a partida atual.
   *
   * Goleiro fixo fica fora da fila dos jogadores de linha. Ao voltar a ser
   * jogador de linha durante uma pelada, entra no fim da fila somente se ja
   * chegou, esta disponivel e nao pertence a um time ativo.
   */
  async alterarGoleiroFixo(
    usuarioId: string,
    peladaId: string,
    id: string,
    ehGoleiroFixo: boolean,
  ): Promise<ParticipantePeladaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);

    return this.fonteDados.transaction(async (gerenciador) => {
      const participante = await gerenciador.findOne(ParticipantePeladaEntity, {
        where: { id, peladaId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!participante)
        throw new NotFoundException('Participante nao encontrado');

      // Alem de economizar escritas, preserva a fila se o cliente repetir uma
      // requisicao cujo resultado ja foi confirmado pelo servidor.
      if (participante.ehGoleiroFixo === ehGoleiroFixo) {
        return participante;
      }

      participante.ehGoleiroFixo = ehGoleiroFixo;
      await gerenciador.save(participante);

      if (ehGoleiroFixo) {
        await gerenciador.update(
          FilaJogadorEntity,
          { peladaId, participanteId: id, ativo: true },
          { ativo: false, saiuEm: new Date() },
        );
        return participante;
      }

      const disponivelParaFila =
        pelada.status === StatusPelada.EM_ANDAMENTO &&
        participante.ordemChegada !== null &&
        [
          StatusParticipantePelada.PRESENTE,
          StatusParticipantePelada.AGUARDANDO,
        ].includes(participante.status);
      if (!disponivelParaFila) return participante;

      const [emTime, jaNaFila] = await Promise.all([
        gerenciador.findOne(JogadorTimeEntity, {
          where: { participanteId: id, ativo: true },
        }),
        gerenciador.findOne(FilaJogadorEntity, {
          where: { peladaId, participanteId: id, ativo: true },
        }),
      ]);
      if (emTime || jaNaFila) return participante;

      const ultima = await gerenciador
        .createQueryBuilder(FilaJogadorEntity, 'f')
        .select('COALESCE(MAX(f.posicao), 0)', 'maximo')
        .where('f.peladaId = :peladaId AND f.ativo = true', { peladaId })
        .getRawOne<{ maximo: string }>();

      await gerenciador.save(
        gerenciador.create(FilaJogadorEntity, {
          peladaId,
          participanteId: id,
          posicao: Number(ultima?.maximo ?? 0) + 1,
          ativo: true,
          saiuEm: null,
        }),
      );

      return participante;
    });
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

    // A trava e ter JOGADO, nao ter chegado. Quem entrou em campo tem
    // participacoes, eventos e pontuacao apontando para ele: apagar destruiria
    // o historico das partidas, e a saida correta e a desistencia. Mas quem so
    // foi cadastrado — inclusive quem chegou e ainda nao jogou — costuma ser
    // nome digitado errado, e deve poder sumir da tela.
    //
    // A fila e o elenco saem junto por CASCADE nas chaves estrangeiras.
    const jogou = await this.participacoes.count({
      where: { participanteId: id },
    });
    if (jogou > 0) {
      throw new ErroRegraPelada(
        'PARTICIPANTE_JA_JOGOU',
        'Quem ja entrou em campo nao pode ser apagado: use desistencia para preservar os gols e pontos dele',
      );
    }

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
