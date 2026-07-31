import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { MaquinaStatusPelada } from '../../dominio/pelada/maquina-status-pelada';

/**
 * Edicao manual da fila dos proximos.
 *
 * A rotacao automatica acerta na maioria das vezes, mas a pelada real tem
 * combinado que o sistema nao conhece: quem chegou junto quer jogar junto,
 * quem vai embora cedo pede pra entrar antes, alguem cede a vez. O organizador
 * precisa poder sobrepor a fila a qualquer momento, sem desfazer a partida.
 *
 * A ordem de chegada (`ParticipantePelada.ordemChegada`) e outra coisa: ela
 * so alimenta o sorteio inicial. Mexer nela depois que a pelada comecou nao
 * muda quem entra — quem manda daqui pra frente e a `posicao` desta fila.
 */
@Injectable()
export class FilaService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    @InjectRepository(ParticipantePeladaEntity)
    private readonly participantes: Repository<ParticipantePeladaEntity>,
    @InjectRepository(FilaJogadorEntity)
    private readonly fila: Repository<FilaJogadorEntity>,
    @InjectRepository(JogadorTimeEntity)
    private readonly jogadoresTime: Repository<JogadorTimeEntity>,
    @InjectRepository(PartidaEntity)
    private readonly partidas: Repository<PartidaEntity>,
    private readonly fonteDados: DataSource,
  ) {}

  /**
   * Reescreve a fila inteira na ordem recebida.
   *
   * Exige a lista completa em vez de aceitar um "mova X para a posicao N"
   * porque a tela ja tem a fila inteira na mao: mandar o resultado final
   * elimina a chance de duas edicoes simultaneas se intercalarem e produzirem
   * uma ordem que ninguem pediu.
   */
  async reordenar(
    usuarioId: string,
    peladaId: string,
    participanteIds: string[],
  ): Promise<FilaJogadorEntity[]> {
    await this.carregarPelada(usuarioId, peladaId);

    const atual = await this.fila.find({
      where: { peladaId, ativo: true },
    });
    const idsAtuais = new Set(atual.map((f) => f.participanteId));

    const semDuplicata =
      new Set(participanteIds).size === participanteIds.length;
    const mesmoConjunto =
      participanteIds.length === idsAtuais.size &&
      participanteIds.every((id) => idsAtuais.has(id));

    if (!semDuplicata || !mesmoConjunto)
      throw new ErroRegraPelada(
        'FILA_INVALIDA',
        'A ordem deve conter exatamente quem esta na fila, uma vez cada',
        { naFila: idsAtuais.size, recebido: participanteIds.length },
      );

    return this.reescrever(peladaId, participanteIds);
  }

  /**
   * Coloca alguem na fila — quem estava de fora, voltou de pausa, ou saiu de
   * um time. Sem `posicao`, entra no fim.
   */
  async adicionar(
    usuarioId: string,
    peladaId: string,
    participanteId: string,
    posicao?: number,
  ): Promise<FilaJogadorEntity[]> {
    await this.carregarPelada(usuarioId, peladaId);
    const participante = await this.carregarParticipante(
      peladaId,
      participanteId,
    );

    if (participante.status === StatusParticipantePelada.DESISTIU)
      throw new ErroRegraPelada(
        'PARTICIPANTE_DESISTIU',
        'Quem desistiu precisa voltar para a pelada antes de entrar na fila',
      );

    if (participante.status !== StatusParticipantePelada.PRESENTE)
      throw new ErroRegraPelada(
        'PARTICIPANTE_AUSENTE',
        'Marque a chegada do jogador antes de coloca-lo na fila',
      );

    if (participante.ehGoleiroFixo)
      throw new ErroRegraPelada(
        'GOLEIRO_FIXO_FORA_DA_FILA',
        'Goleiro fixo nao participa da fila de rotacao',
      );

    const emTime = await this.jogadoresTime.findOne({
      where: { participanteId, ativo: true },
    });
    if (emTime)
      throw new ErroRegraPelada(
        'PARTICIPANTE_EM_TIME',
        'Este jogador esta em um time: tire-o do time antes de enfileirar',
      );

    const ordem = (await this.ordemAtual(peladaId)).filter(
      (id) => id !== participanteId,
    );

    // Sem posicao vai para o fim; com posicao, 1 e o proximo a entrar.
    const alvo =
      posicao === undefined
        ? ordem.length
        : Math.min(Math.max(posicao - 1, 0), ordem.length);
    ordem.splice(alvo, 0, participanteId);

    return this.reescrever(peladaId, ordem);
  }

  async remover(
    usuarioId: string,
    peladaId: string,
    participanteId: string,
  ): Promise<FilaJogadorEntity[]> {
    await this.carregarPelada(usuarioId, peladaId);

    const ordem = await this.ordemAtual(peladaId);
    if (!ordem.includes(participanteId))
      throw new ErroRegraPelada(
        'PARTICIPANTE_FORA_DA_FILA',
        'Este jogador nao esta na fila',
      );

    return this.reescrever(
      peladaId,
      ordem.filter((id) => id !== participanteId),
    );
  }

  /**
   * Troca alguem da fila por alguem que esta em um time, entre partidas.
   *
   * Durante a partida isso e substituicao, que precisa registrar entrada e
   * saida na participacao para a pontuacao sair certa. Aqui nao ha partida
   * rodando: e so mexer no elenco e na fila.
   */
  async entrarNoLugarDe(
    usuarioId: string,
    peladaId: string,
    participanteId: string,
    saiId: string,
  ): Promise<FilaJogadorEntity[]> {
    await this.carregarPelada(usuarioId, peladaId);

    if (participanteId === saiId)
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
        'A partida ja comecou: use substituicao',
      );

    const ordem = await this.ordemAtual(peladaId);
    if (!ordem.includes(participanteId))
      throw new ErroRegraPelada(
        'PARTICIPANTE_FORA_DA_FILA',
        'Quem entra precisa estar na fila',
      );

    const entradaJaEmTime = await this.jogadoresTime.findOne({
      where: { participanteId, ativo: true },
    });
    if (entradaJaEmTime)
      throw new ErroRegraPelada(
        'PARTICIPANTE_EM_TIME',
        'Este jogador ja esta cobrindo ou ocupando uma vaga em outro time',
      );

    const vaga = await this.jogadoresTime.findOne({
      where: { participanteId: saiId, ativo: true },
    });
    if (!vaga)
      throw new ErroRegraPelada(
        'PARTICIPANTE_FORA_DE_TIME',
        'Quem sai precisa estar em um time',
      );
    const participanteSai = await this.carregarParticipante(peladaId, saiId);

    return this.fonteDados.transaction(async (gerenciador) => {
      const coberturaTemporaria =
        participanteSai.status === StatusParticipantePelada.DESCANSANDO;
      if (coberturaTemporaria) {
        // A vaga continua pertencendo a quem esta FORA. O novo membro e uma
        // cobertura temporaria, que pode ser devolvida sem inverter os dois
        // jogadores quando o titular retornar.
        await gerenciador.save(
          gerenciador.create(JogadorTimeEntity, {
            timeId: vaga.timeId,
            participanteId,
            substituiParticipanteId: saiId,
            ehGoleiro: vaga.ehGoleiro,
            ativo: true,
            saiuEm: null,
          }),
        );
      } else {
        // Na troca comum, quem entra assume a vaga exata de quem sai,
        // inclusive a condicao de goleiro.
        await gerenciador.update(JogadorTimeEntity, vaga.id, {
          participanteId,
        });
      }

      // Cobrir quem esta FORA nao consome a vez de quem ajuda: ele continua
      // na mesma posicao da fila enquanto joga temporariamente. Apenas uma
      // troca definitiva remove quem entrou da fila.
      const nova = coberturaTemporaria
        ? [...ordem]
        : ordem.filter((id) => id !== participanteId);
      // Quem saiu do time volta na frente da fila: perdeu a vez sem ter
      // pedido, entao e o proximo a entrar. A excecao e quem ja estava FORA:
      // continua descansando ate o organizador mandar voltar.
      if (!coberturaTemporaria) {
        nova.unshift(saiId);
      }

      await this.reescreverCom(gerenciador, peladaId, nova);
      return gerenciador.find(FilaJogadorEntity, {
        where: { peladaId, ativo: true },
        relations: ['participante', 'participante.jogador'],
        order: { posicao: 'ASC' },
      });
    });
  }

  /**
   * Poe alguem da fila numa vaga aberta de um time.
   *
   * Quando alguem desiste ou vai embora, o vinculo com o time e desativado e
   * sobra um buraco: nao ha ninguem para trocar, entao `entrarNoLugarDe` nao
   * serve e o time seguiria jogando desfalcado sem saida pelo app.
   *
   * Funciona tambem com a partida em andamento — e exatamente quando costuma
   * acontecer. Nesse caso cria tambem a participacao, senao quem entrou nao
   * poderia marcar gol nem pontuaria ao final.
   */
  async completarTime(
    usuarioId: string,
    peladaId: string,
    participanteId: string,
    timeId: string,
  ): Promise<FilaJogadorEntity[]> {
    await this.carregarPelada(usuarioId, peladaId);

    const ordem = await this.ordemAtual(peladaId);
    if (!ordem.includes(participanteId))
      throw new ErroRegraPelada(
        'PARTICIPANTE_FORA_DA_FILA',
        'Quem entra precisa estar na fila',
      );

    const jaEmTime = await this.jogadoresTime.findOne({
      where: { participanteId, ativo: true },
    });
    if (jaEmTime)
      throw new ErroRegraPelada(
        'PARTICIPANTE_EM_TIME',
        'Este jogador ja esta em um time',
      );

    return this.fonteDados.transaction(async (gerenciador) => {
      await gerenciador.save(
        gerenciador.create(JogadorTimeEntity, {
          timeId,
          participanteId,
          ativo: true,
          ehGoleiro: false,
          saiuEm: null,
        }),
      );

      const emAndamento = await gerenciador.findOne(PartidaEntity, {
        where: { peladaId, status: StatusPartida.EM_ANDAMENTO },
      });
      if (emAndamento) {
        await gerenciador.save(
          gerenciador.create(ParticipacaoPartidaEntity, {
            partidaId: emAndamento.id,
            participanteId,
            timeId,
            ehGoleiro: false,
            saiuEm: null,
            minutosJogados: null,
          }),
        );
      }

      await this.reescreverCom(
        gerenciador,
        peladaId,
        ordem.filter((id) => id !== participanteId),
      );
      return gerenciador.find(FilaJogadorEntity, {
        where: { peladaId },
        relations: ['participante', 'participante.jogador'],
        order: { posicao: 'ASC' },
      });
    });
  }

  private async ordemAtual(peladaId: string): Promise<string[]> {
    const atual = await this.fila.find({
      where: { peladaId, ativo: true },
      order: { posicao: 'ASC' },
    });
    return atual.map((f) => f.participanteId);
  }

  private reescrever(
    peladaId: string,
    ordem: string[],
  ): Promise<FilaJogadorEntity[]> {
    return this.fonteDados.transaction(async (gerenciador) => {
      await this.reescreverCom(gerenciador, peladaId, ordem);
      return gerenciador.find(FilaJogadorEntity, {
        where: { peladaId, ativo: true },
        relations: ['participante', 'participante.jogador'],
        order: { posicao: 'ASC' },
      });
    });
  }

  /**
   * Apaga e recria em vez de atualizar `posicao` uma a uma.
   *
   * O indice (pelada_id, posicao) e UNIQUE, entao qualquer reordenacao feita
   * com UPDATE colide no meio do caminho — o primeiro registro movido bate no
   * que ainda ocupa o destino. E o mesmo caminho que a rotacao automatica ja
   * usa, o que mantem os dois com o mesmo comportamento.
   */
  private async reescreverCom(
    gerenciador: EntityManager,
    peladaId: string,
    ordem: string[],
  ): Promise<void> {
    await gerenciador.delete(FilaJogadorEntity, { peladaId, ativo: true });
    if (ordem.length === 0) return;
    await gerenciador.save(
      ordem.map((participanteId, indice) =>
        gerenciador.create(FilaJogadorEntity, {
          peladaId,
          participanteId,
          posicao: indice + 1,
          ativo: true,
        }),
      ),
    );
  }

  private async carregarPelada(
    usuarioId: string,
    peladaId: string,
  ): Promise<PeladaEntity> {
    // 404 e nao 403: um 403 confirmaria que a pelada existe para quem so
    // esta chutando identificadores.
    const pelada = await this.peladas.findOne({
      where: { id: peladaId, organizadorId: usuarioId },
    });
    if (!pelada) throw new NotFoundException('Pelada nao encontrada');
    if (MaquinaStatusPelada.estaEncerrada(pelada.status))
      throw new ErroRegraPelada('PELADA_ENCERRADA', 'Pelada encerrada');
    return pelada;
  }

  private async carregarParticipante(
    peladaId: string,
    participanteId: string,
  ): Promise<ParticipantePeladaEntity> {
    const participante = await this.participantes.findOne({
      where: { id: participanteId, peladaId },
    });
    if (!participante)
      throw new NotFoundException('Participante nao encontrado');
    return participante;
  }
}
