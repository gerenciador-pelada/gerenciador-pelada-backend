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
import { ConfiguracaoPeladaEntity } from '../../banco/entidades/configuracao-pelada.entity';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { PontuacaoJogadorEntity } from '../../banco/entidades/pontuacao-jogador.entity';
import { TimeEntity } from '../../banco/entidades/time.entity';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { CalculadoraPontuacao } from '../../dominio/pelada/calculadora-pontuacao';
import {
  LadoPartida,
  resolverResultadoFinal,
} from '../../dominio/pelada/finalizacao-pelada';
import { MaquinaStatusPelada } from '../../dominio/pelada/maquina-status-pelada';
import {
  JogadorRotacao,
  MotorPelada,
  TimeRotacao,
} from '../../dominio/pelada/motor-pelada';

interface FinalizarOpcoes {
  vencedorDecisao?: 'CASA' | 'VISITANTE';
  escolhaAdmin?: 'CASA' | 'VISITANTE';
}

export interface ResumoFinalizacaoPelada {
  peladaId: string;
  status: StatusPelada.FINALIZADA;
  partidaFinalizada: {
    id: string;
    golsCasa: number;
    golsVisitante: number;
    vencedorDecisao: LadoPartida | null;
  } | null;
  partidasCanceladas: number;
  jaEstavaFinalizada: boolean;
}

@Injectable()
export class PartidasService {
  constructor(
    @InjectRepository(PartidaEntity)
    private partidas: Repository<PartidaEntity>,
    private readonly fonteDados: DataSource,
  ) {}

  /**
   * Coloca a partida em campo e materializa quem de fato joga.
   *
   * As ParticipacaoPartida sao criadas aqui, a partir do elenco ativo dos dois
   * times. Sem elas nenhum evento pode ser registrado, porque o registro de gol
   * valida o autor contra a participacao.
   */
  async iniciar(usuarioId: string, id: string) {
    const partida = await this.buscar(usuarioId, id);
    if (partida.status !== StatusPartida.AGUARDANDO)
      throw new ErroRegraPelada(
        'PARTIDA_NAO_AGUARDANDO',
        'Partida nao pode iniciar',
      );

    return this.fonteDados.transaction(async (gerenciador) => {
      const elenco = await gerenciador.find(JogadorTimeEntity, {
        where: [
          { timeId: partida.timeCasaId, ativo: true },
          { timeId: partida.timeVisitanteId, ativo: true },
        ],
      });
      const titularesCobertos = new Set(
        elenco
          .map((membro) => membro.substituiParticipanteId)
          .filter((id): id is string => Boolean(id)),
      );
      const elencoEmCampo = elenco.filter(
        (membro) => !titularesCobertos.has(membro.participanteId),
      );
      const idsElenco = new Set(
        elencoEmCampo.map((membro) => membro.participanteId),
      );
      if (idsElenco.size) {
        await gerenciador.update(
          ParticipantePeladaEntity,
          { id: In([...idsElenco]) },
          { status: StatusParticipantePelada.JOGANDO },
        );
      }
      const goleirosAvulsos = [
        partida.goleiroCasaId
          ? {
              participanteId: partida.goleiroCasaId,
              timeId: partida.timeCasaId,
            }
          : null,
        partida.goleiroVisitanteId
          ? {
              participanteId: partida.goleiroVisitanteId,
              timeId: partida.timeVisitanteId,
            }
          : null,
      ].filter(
        (goleiro): goleiro is { participanteId: string; timeId: string } =>
          goleiro !== null && !idsElenco.has(goleiro.participanteId),
      );

      await gerenciador.save(
        [
          ...elencoEmCampo.map((membro) => ({
            participanteId: membro.participanteId,
            timeId: membro.timeId,
            ehGoleiro: membro.ehGoleiro,
          })),
          ...goleirosAvulsos.map((goleiro) => ({
            ...goleiro,
            ehGoleiro: true,
          })),
        ].map((membro) =>
          gerenciador.create(ParticipacaoPartidaEntity, {
            partidaId: partida.id,
            participanteId: membro.participanteId,
            timeId: membro.timeId,
            ehGoleiro: membro.ehGoleiro,
            saiuEm: null,
            minutosJogados: null,
          }),
        ),
      );

      partida.status = StatusPartida.EM_ANDAMENTO;
      partida.iniciadaEm = new Date();
      return gerenciador.save(partida);
    });
  }

  /**
   * Encerra a partida, pontua os participantes e prepara o proximo confronto.
   *
   * Este e o ponto onde a camada de dominio finalmente e usada: a rotacao sai
   * do MotorPelada e a pontuacao da CalculadoraPontuacao, ambos alimentados
   * pela configuracao da pelada. Nenhum valor de regra aparece aqui.
   */
  async finalizar(usuarioId: string, id: string, opcoes: FinalizarOpcoes = {}) {
    const partida = await this.buscar(usuarioId, id);
    if (partida.status !== StatusPartida.EM_ANDAMENTO)
      throw new ErroRegraPelada(
        'PARTIDA_NAO_EM_ANDAMENTO',
        'Partida nao esta em andamento',
      );

    return this.fonteDados.transaction(async (gerenciador) => {
      const pelada = await gerenciador.findOne(PeladaEntity, {
        where: { id: partida.peladaId },
        relations: ['configuracao'],
      });
      if (!pelada) throw new NotFoundException('Pelada nao encontrada');
      const configuracao = pelada.configuracao;

      const empatou = partida.golsCasa === partida.golsVisitante;
      if (empatou && !configuracao.permiteEmpate) {
        throw new ErroRegraPelada(
          'EMPATE_NAO_PERMITIDO',
          'Esta pelada nao permite empate: registre o desempate',
        );
      }

      const timeVencedorId = empatou
        ? null
        : partida.golsCasa > partida.golsVisitante
          ? partida.timeCasaId
          : partida.timeVisitanteId;
      await this.pontuar(gerenciador, partida, configuracao, timeVencedorId);

      partida.status = StatusPartida.FINALIZADA;
      partida.finalizadaEm = new Date();
      partida.vencedorDecisao = empatou
        ? (opcoes.vencedorDecisao ?? null)
        : null;
      await gerenciador.save(partida);

      const proxima = await this.rotacionar(
        gerenciador,
        partida,
        configuracao,
        empatou,
        opcoes,
      );

      return { partida, proximaPartida: proxima };
    });
  }

  /**
   * Encerra a pelada inteira em uma unica transacao.
   *
   * Diferente de `finalizar`, este fluxo nao rotaciona os times nem cria uma
   * partida seguinte. O lock na pelada serializa tentativas concorrentes e
   * torna uma repeticao depois de timeout segura.
   */
  async finalizarPelada(
    usuarioId: string,
    peladaId: string,
    opcoes: Pick<FinalizarOpcoes, 'vencedorDecisao'> = {},
  ): Promise<ResumoFinalizacaoPelada> {
    return this.fonteDados.transaction(async (gerenciador) => {
      const pelada = await gerenciador.findOne(PeladaEntity, {
        where: { id: peladaId, organizadorId: usuarioId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!pelada) throw new NotFoundException('Pelada nao encontrada');

      if (pelada.status === StatusPelada.FINALIZADA) {
        return this.montarResumoFinalizado(gerenciador, peladaId);
      }

      MaquinaStatusPelada.garantirTransicao(
        pelada.status,
        StatusPelada.FINALIZADA,
      );

      const configuracao = await gerenciador.findOne(ConfiguracaoPeladaEntity, {
        where: { peladaId },
      });
      if (!configuracao) {
        throw new NotFoundException('Configuracao da pelada nao encontrada');
      }

      const partida = await gerenciador.findOne(PartidaEntity, {
        where: { peladaId, status: StatusPartida.EM_ANDAMENTO },
        order: { numero: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });

      if (partida) {
        const resultado = resolverResultadoFinal(
          partida.golsCasa,
          partida.golsVisitante,
          configuracao.permiteEmpate,
          configuracao.regraEmpate,
          opcoes.vencedorDecisao,
        );
        const timeVencedorId =
          resultado.vencedor === 'CASA'
            ? partida.timeCasaId
            : resultado.vencedor === 'VISITANTE'
              ? partida.timeVisitanteId
              : null;

        await this.pontuar(gerenciador, partida, configuracao, timeVencedorId);
        partida.status = StatusPartida.FINALIZADA;
        partida.finalizadaEm = new Date();
        partida.vencedorDecisao = resultado.vencedorPorDecisao;
        await gerenciador.save(partida);
      }

      const cancelamento = await gerenciador.update(
        PartidaEntity,
        { peladaId, status: StatusPartida.AGUARDANDO },
        { status: StatusPartida.CANCELADA },
      );

      pelada.status = StatusPelada.FINALIZADA;
      await gerenciador.save(pelada);

      return this.criarResumo(
        peladaId,
        partida,
        cancelamento.affected ?? 0,
        false,
      );
    });
  }

  /**
   * Troca um jogador em campo por outro da fila, com a partida rolando.
   *
   * Os dois contam como tendo jogado a partida: quem sai mantem a participacao
   * (com saiuEm) e quem entra ganha a sua. Na pelada ninguem diz "joguei 40%
   * dessa partida" — os dois recebem os pontos do resultado.
   *
   * Quem entra herda o papel exato, inclusive ehGoleiro: trocar o goleiro sem
   * isso deixaria o time com dois de linha e o gol vazio. Quem sai vai para o
   * fim da fila, porque acabou de jogar. Quem ja estava temporariamente FORA
   * conserva o descanso sem entrar na fila; o organizador decide quando volta.
   */
  /**
   * Para o cronometro sem encerrar a partida — chuva, discussao, bola na rua.
   *
   * Fecha o trecho corrido somando em `segundosAcumulados` e marca `pausadaEm`.
   * Assim o tempo nunca depende de quem esta olhando: dois celulares na mesma
   * partida leem o mesmo relogio, e um F5 nao ressuscita o tempo parado.
   */
  async pausar(usuarioId: string, partidaId: string): Promise<PartidaEntity> {
    const partida = await this.buscar(usuarioId, partidaId);
    if (partida.status !== StatusPartida.EM_ANDAMENTO)
      throw new ErroRegraPelada(
        'PARTIDA_NAO_EM_ANDAMENTO',
        'So da para pausar uma partida em andamento',
      );
    if (partida.pausadaEm) return partida; // idempotente: dois toques nao somam

    const desde = partida.iniciadaEm ?? new Date();
    const corridos = Math.max(
      0,
      Math.floor((Date.now() - desde.getTime()) / 1000),
    );
    await this.partidas.update(partidaId, {
      pausadaEm: new Date(),
      segundosAcumulados: partida.segundosAcumulados + corridos,
    });
    return this.buscar(usuarioId, partidaId);
  }

  /**
   * Retoma. `iniciadaEm` vira agora: o que ja correu esta em
   * `segundosAcumulados`, entao a referencia recomeca do zero deste trecho.
   */
  async retomar(usuarioId: string, partidaId: string): Promise<PartidaEntity> {
    const partida = await this.buscar(usuarioId, partidaId);
    if (partida.status !== StatusPartida.EM_ANDAMENTO)
      throw new ErroRegraPelada(
        'PARTIDA_NAO_EM_ANDAMENTO',
        'So da para retomar uma partida em andamento',
      );
    if (!partida.pausadaEm) return partida;

    await this.partidas.update(partidaId, {
      pausadaEm: null,
      iniciadaEm: new Date(),
    });
    return this.buscar(usuarioId, partidaId);
  }

  /**
   * Zera relogio E placar, deixando a partida parada no zero.
   *
   * O placar vai junto por decisao do organizador: quando ele zera, e porque a
   * partida vai recomecar do nada — manter os gols daria um placar que nao
   * corresponde a nenhum tempo jogado. Os eventos ja registrados sao apagados
   * pelo mesmo motivo, senao o historico contaria gols de uma partida que
   * deixou de existir.
   */
  async zerar(usuarioId: string, partidaId: string): Promise<PartidaEntity> {
    const partida = await this.buscar(usuarioId, partidaId);
    if (partida.status === StatusPartida.FINALIZADA)
      throw new ErroRegraPelada(
        'PARTIDA_FINALIZADA',
        'Partida ja encerrada: nao da para zerar',
      );

    return this.fonteDados.transaction(async (gerenciador) => {
      await gerenciador.delete(EventoPartidaEntity, { partidaId });
      await gerenciador.update(PartidaEntity, partidaId, {
        golsCasa: 0,
        golsVisitante: 0,
        segundosAcumulados: 0,
        pausadaEm: new Date(),
        iniciadaEm: new Date(),
      });
      return gerenciador.findOneOrFail(PartidaEntity, {
        where: { id: partidaId },
      });
    });
  }

  async substituir(
    usuarioId: string,
    partidaId: string,
    saiId: string,
    entraId: string,
  ) {
    const partida = await this.buscar(usuarioId, partidaId);
    if (partida.status !== StatusPartida.EM_ANDAMENTO)
      throw new ErroRegraPelada(
        'PARTIDA_NAO_EM_ANDAMENTO',
        'So da para substituir com a partida em andamento',
      );
    if (saiId === entraId)
      throw new ErroRegraPelada(
        'SUBSTITUICAO_INVALIDA',
        'Escolha dois jogadores diferentes',
      );

    return this.fonteDados.transaction(async (gerenciador) => {
      const participacaoSai = await gerenciador.findOne(
        ParticipacaoPartidaEntity,
        { where: { partidaId, participanteId: saiId, saiuEm: IsNull() } },
      );
      const participanteSai = await gerenciador.findOne(
        ParticipantePeladaEntity,
        { where: { id: saiId, peladaId: partida.peladaId } },
      );
      const estavaDescansando =
        participanteSai?.status === StatusParticipantePelada.DESCANSANDO;
      if (!participacaoSai && !estavaDescansando)
        throw new ErroRegraPelada(
          'JOGADOR_FORA_DA_PARTIDA',
          'Quem sai precisa estar em campo nesta partida',
        );

      const jaJoga = await gerenciador.findOne(ParticipacaoPartidaEntity, {
        where: { partidaId, participanteId: entraId, saiuEm: IsNull() },
      });
      if (jaJoga)
        throw new ErroRegraPelada(
          'JOGADOR_JA_EM_CAMPO',
          'Quem entra ja esta em campo nesta partida',
        );

      const membroSai = await gerenciador.findOne(JogadorTimeEntity, {
        where: participacaoSai
          ? {
              timeId: participacaoSai.timeId,
              participanteId: saiId,
              ativo: true,
            }
          : [
              {
                timeId: partida.timeCasaId,
                participanteId: saiId,
                ativo: true,
              },
              {
                timeId: partida.timeVisitanteId,
                participanteId: saiId,
                ativo: true,
              },
            ],
      });
      if (!membroSai && !participacaoSai)
        throw new ErroRegraPelada(
          'JOGADOR_SEM_VAGA',
          'Quem sai precisa ter uma vaga em um dos times da partida',
        );
      const timeId = participacaoSai?.timeId ?? membroSai!.timeId;
      const ehGoleiro =
        membroSai?.ehGoleiro ?? participacaoSai?.ehGoleiro ?? false;
      const substituiParticipanteId =
        membroSai?.substituiParticipanteId ??
        (estavaDescansando ? saiId : null);
      const preservaVagaTitular =
        estavaDescansando && !membroSai?.substituiParticipanteId;
      const substituicaoTemporaria = Boolean(substituiParticipanteId);

      // Sai do time e da partida, guardando quando saiu.
      const agora = new Date();
      if (participacaoSai) {
        await gerenciador.update(
          ParticipacaoPartidaEntity,
          participacaoSai.id,
          { saiuEm: agora },
        );
      }
      if (membroSai && !preservaVagaTitular) {
        await gerenciador.update(JogadorTimeEntity, membroSai.id, {
          ativo: false,
          saiuEm: agora,
        });
      }

      // Entra no time e na partida, herdando o papel — e o lugar na fila que a
      // vaga carrega. Quem assume a vaga assume a espera dela; sem isso o
      // substituto entraria como primeiro do time quando ele voltasse a fila.
      await gerenciador.save(
        gerenciador.create(JogadorTimeEntity, {
          timeId,
          participanteId: entraId,
          substituiParticipanteId,
          ehGoleiro,
          ordemEntrada:
            membroSai?.ordemEntrada ??
            (await this.proximaOrdemEntrada(gerenciador, timeId)),
          ativo: true,
          saiuEm: null,
        }),
      );
      await gerenciador.save(
        gerenciador.create(ParticipacaoPartidaEntity, {
          partidaId,
          participanteId: entraId,
          timeId,
          ehGoleiro,
          saiuEm: null,
          minutosJogados: null,
        }),
      );

      // Na cobertura temporaria, tanto quem entra quanto um substituto que
      // sai preservam suas posicoes atuais. A fila so muda numa substituicao
      // definitiva entre dois jogadores de campo.
      if (!substituicaoTemporaria) {
        await gerenciador.update(
          FilaJogadorEntity,
          { peladaId: partida.peladaId, participanteId: entraId, ativo: true },
          { ativo: false, saiuEm: agora },
        );
      }
      if (!estavaDescansando && !membroSai?.substituiParticipanteId) {
        const ultima = await gerenciador
          .createQueryBuilder(FilaJogadorEntity, 'f')
          .select('COALESCE(MAX(f.posicao), 0)', 'maximo')
          .where('f.peladaId = :peladaId AND f.ativo = true', {
            peladaId: partida.peladaId,
          })
          .getRawOne<{ maximo: string }>();
        await gerenciador.save(
          gerenciador.create(FilaJogadorEntity, {
            peladaId: partida.peladaId,
            participanteId: saiId,
            posicao: Number(ultima?.maximo ?? 0) + 1,
            ativo: true,
            saiuEm: null,
          }),
        );
      }

      return { saiu: saiId, entrou: entraId, ehGoleiro };
    });
  }

  async cancelar(usuarioId: string, id: string) {
    const p = await this.buscar(usuarioId, id);
    if (p.status === StatusPartida.FINALIZADA)
      throw new ErroRegraPelada(
        'PARTIDA_FINALIZADA',
        'Partida finalizada nao pode cancelar',
      );
    p.status = StatusPartida.CANCELADA;
    return this.partidas.save(p);
  }

  /** Grava quanto cada participante pontuou nesta partida, detalhado por origem. */
  /**
   * Refaz a pontuacao de uma partida ja encerrada.
   *
   * A pontuacao e congelada na finalizacao — e proposital, porque as regras da
   * pelada podem mudar depois e o passado nao deve se reescrever sozinho. Mas
   * quando um gol foi esquecido no calor do jogo, o que esta congelado esta
   * simplesmente errado, e o organizador precisa poder consertar.
   *
   * Apaga e recalcula em vez de somar a diferenca: somar exigiria saber o que
   * cada evento contribuiu, e um erro de sinal ali ficaria escondido para
   * sempre. Recalcular do zero sempre chega no valor certo.
   */
  async recalcularPontuacao(
    usuarioId: string,
    partidaId: string,
  ): Promise<void> {
    const partida = await this.buscar(usuarioId, partidaId);
    if (partida.status !== StatusPartida.FINALIZADA) return;

    await this.fonteDados.transaction(async (gerenciador) => {
      const pelada = await gerenciador.findOne(PeladaEntity, {
        where: { id: partida.peladaId },
        relations: ['configuracao'],
      });
      if (!pelada) throw new NotFoundException('Pelada nao encontrada');

      const empatou = partida.golsCasa === partida.golsVisitante;
      const timeVencedorId = empatou
        ? partida.vencedorDecisao === 'CASA'
          ? partida.timeCasaId
          : partida.vencedorDecisao === 'VISITANTE'
            ? partida.timeVisitanteId
            : null
        : partida.golsCasa > partida.golsVisitante
          ? partida.timeCasaId
          : partida.timeVisitanteId;

      await gerenciador.delete(PontuacaoJogadorEntity, { partidaId });
      await this.pontuar(
        gerenciador,
        partida,
        pelada.configuracao,
        timeVencedorId,
      );
    });
  }

  private async pontuar(
    gerenciador: EntityManager,
    partida: PartidaEntity,
    configuracao: ConfiguracaoPeladaEntity,
    timeVencedorId: string | null,
  ): Promise<void> {
    const participacoes = await gerenciador.find(ParticipacaoPartidaEntity, {
      where: { partidaId: partida.id },
    });
    if (!participacoes.length) return;

    const eventos = await gerenciador.find(EventoPartidaEntity, {
      where: { partidaId: partida.id },
    });
    const participantes = await gerenciador.find(ParticipantePeladaEntity, {
      where: participacoes.map((p) => ({ id: p.participanteId })),
    });
    const jogadorPorParticipante = new Map(
      participantes.map((p) => [p.id, p.jogadorId]),
    );

    const contar = (participanteId: string, tipo: TipoEventoPartida) =>
      eventos.filter(
        (e) => e.participanteId === participanteId && e.tipo === tipo,
      ).length;

    const pontuacoes = participacoes.map((participacao) => {
      const resultado =
        timeVencedorId === null
          ? 'EMPATE'
          : participacao.timeId === timeVencedorId
            ? 'VITORIA'
            : 'DERROTA';

      const calculo = CalculadoraPontuacao.calcular(configuracao, {
        gols: contar(participacao.participanteId, TipoEventoPartida.GOL),
        assistencias: eventos.filter(
          (e) =>
            e.participanteRelacionadoId === participacao.participanteId &&
            e.tipo === TipoEventoPartida.GOL,
        ).length,
        bolasCheias: contar(
          participacao.participanteId,
          TipoEventoPartida.BOLA_CHEIA,
        ),
        bolasMurchas:
          contar(participacao.participanteId, TipoEventoPartida.BOLA_MURCHA) +
          contar(participacao.participanteId, TipoEventoPartida.GOL_CONTRA),
        resultado,
      });

      return gerenciador.create(PontuacaoJogadorEntity, {
        peladaId: partida.peladaId,
        partidaId: partida.id,
        participanteId: participacao.participanteId,
        jogadorId:
          jogadorPorParticipante.get(participacao.participanteId) ?? '',
        pontosVitoria: calculo.pontosResultado,
        pontosGols: calculo.pontosGols,
        pontosAssistencias: calculo.pontosAssistencias,
        pontosBolaCheia: calculo.pontosBolaCheia,
        pontosBolaMurcha: calculo.pontosBolaMurcha,
        pontosTotal: calculo.pontosTotal,
      });
    });

    await gerenciador.delete(PontuacaoJogadorEntity, { partidaId: partida.id });
    await gerenciador.save(pontuacoes);
  }

  private criarResumo(
    peladaId: string,
    partida: PartidaEntity | null,
    partidasCanceladas: number,
    jaEstavaFinalizada: boolean,
  ): ResumoFinalizacaoPelada {
    return {
      peladaId,
      status: StatusPelada.FINALIZADA,
      partidaFinalizada: partida
        ? {
            id: partida.id,
            golsCasa: partida.golsCasa,
            golsVisitante: partida.golsVisitante,
            vencedorDecisao: partida.vencedorDecisao ?? null,
          }
        : null,
      partidasCanceladas,
      jaEstavaFinalizada,
    };
  }

  private async montarResumoFinalizado(
    gerenciador: EntityManager,
    peladaId: string,
  ): Promise<ResumoFinalizacaoPelada> {
    const ultimaPartida = await gerenciador.findOne(PartidaEntity, {
      where: { peladaId, status: StatusPartida.FINALIZADA },
      order: { numero: 'DESC' },
    });
    return this.criarResumo(peladaId, ultimaPartida, 0, true);
  }

  /**
   * Aplica a rotacao: quem fica, quem sai, quem entra, e cria a proxima partida.
   * Devolve null quando nao ha gente suficiente para formar o proximo time.
   */
  private async rotacionar(
    gerenciador: EntityManager,
    partida: PartidaEntity,
    configuracao: ConfiguracaoPeladaEntity,
    empatou: boolean,
    opcoes: FinalizarOpcoes,
  ): Promise<PartidaEntity | null> {
    const goleirosPorTime = new Map<string, string[]>();
    const jogadasPorParticipante = await this.contarPartidasJogadas(
      gerenciador,
      partida.peladaId,
    );
    const casa = await this.montarTimeRotacao(
      gerenciador,
      partida.timeCasaId,
      goleirosPorTime,
      jogadasPorParticipante,
    );
    const visitante = await this.montarTimeRotacao(
      gerenciador,
      partida.timeVisitanteId,
      goleirosPorTime,
      jogadasPorParticipante,
    );
    const fila = await this.montarFila(
      gerenciador,
      partida.peladaId,
      jogadasPorParticipante,
    );

    const saem: TimeRotacao[] = empatou
      ? MotorPelada.empate(
          configuracao.regraEmpate,
          casa,
          visitante,
          opcoes.vencedorDecisao,
          opcoes.escolhaAdmin,
        )
      : [partida.golsCasa > partida.golsVisitante ? visitante : casa];

    const permanece = [casa, visitante].find(
      (t) => !saem.some((s) => s.id === t.id),
    );
    const substitutosTemporarios = permanece
      ? await gerenciador.find(JogadorTimeEntity, {
          where: {
            timeId: permanece.id,
            ativo: true,
            substituiParticipanteId: Not(IsNull()),
          },
        })
      : [];
    const substitutosQueVoltamFila = substitutosTemporarios.map((membro) => {
      const jogador = permanece?.jogadores.find(
        (item) => item.id === membro.participanteId,
      );
      return {
        id: membro.participanteId,
        ordemChegada: jogador?.ordemChegada ?? Number.MAX_SAFE_INTEGER,
      };
    });

    // Goleiro fixo nao entra na rotacao: ele fica no gol e o time que assume o
    // lado dele herda o goleiro. Sem isto o goleiro era dissolvido junto com o
    // time perdedor e caia na fila como jogador de linha.
    const goleirosLiberados = saem.map((t) => goleirosPorTime.get(t.id) ?? []);

    const jogadoresQueSaem = saem.flatMap((t) => t.jogadores);
    const tamanhoTime = configuracao.jogadoresLinhaPorTime;
    const vagas = permanece ? tamanhoTime : tamanhoTime * 2;

    // Quem entra e quem continua esperando e regra de pelada, entao mora no
    // dominio. Este servico so persiste o que ela decidiu.
    //
    // Havia uma segunda copia desta regra aqui, e `MotorPelada.rotacionar`
    // tinha virado codigo morto — as duas divergiram, e foi na copia que a
    // fila deixou de ser FIFO.
    const { entram, sobra: aguardando } = MotorPelada.rotacionar(
      saem,
      fila,
      vagas,
    );

    for (const time of saem) {
      await gerenciador.update(TimeEntity, time.id, {
        ativo: false,
        dissolvidoEm: new Date(),
      });
      await gerenciador.update(
        JogadorTimeEntity,
        { timeId: time.id, ativo: true },
        { ativo: false, saiuEm: new Date() },
      );
    }

    if (permanece) {
      const agora = new Date();
      for (const substituto of substitutosTemporarios) {
        await gerenciador.update(JogadorTimeEntity, substituto.id, {
          ativo: false,
          saiuEm: agora,
        });
      }
      if (substitutosTemporarios.length) {
        await gerenciador.update(
          ParticipantePeladaEntity,
          { id: In(substitutosTemporarios.map((j) => j.participanteId)) },
          { status: StatusParticipantePelada.PRESENTE },
        );
      }
      const venceu = !empatou;
      await gerenciador.update(TimeEntity, permanece.id, {
        partidasConsecutivas: permanece.partidasConsecutivas + 1,
        vitoriasConsecutivas: venceu
          ? (permanece.vitoriasConsecutivas ?? 0) + 1
          : 0,
      });
    }

    // Quem cobriu a vaga de alguem que estava FORA volta para o fim: ele nunca
    // esteve na fila durante a partida, entao nao ha posicao guardada para ele.
    const sobra = [
      ...aguardando,
      ...substitutosQueVoltamFila.filter(
        (substituto) =>
          !fila.some((jogador) => jogador.id === substituto.id) &&
          !jogadoresQueSaem.some((jogador) => jogador.id === substituto.id),
      ),
    ];

    await gerenciador.delete(FilaJogadorEntity, { peladaId: partida.peladaId });
    if (sobra.length) {
      await gerenciador.save(
        sobra.map((j, i) =>
          gerenciador.create(FilaJogadorEntity, {
            peladaId: partida.peladaId,
            participanteId: j.id,
            posicao: i + 1,
            ativo: true,
            saiuEm: null,
          }),
        ),
      );
    }

    if (entram.length < vagas) return null;

    const ordemBase = await gerenciador.count(TimeEntity, {
      where: { peladaId: partida.peladaId },
    });
    const desafiante = await this.criarTime(
      gerenciador,
      partida.peladaId,
      ordemBase + 1,
      entram.slice(0, tamanhoTime),
      goleirosLiberados[0] ?? [],
    );
    const adversario = permanece
      ? await gerenciador.findOneByOrFail(TimeEntity, { id: permanece.id })
      : await this.criarTime(
          gerenciador,
          partida.peladaId,
          ordemBase + 2,
          entram.slice(tamanhoTime),
          goleirosLiberados[1] ?? [],
        );

    return gerenciador.save(
      gerenciador.create(PartidaEntity, {
        peladaId: partida.peladaId,
        numero: partida.numero + 1,
        timeCasaId: adversario.id,
        timeVisitanteId: desafiante.id,
        status: StatusPartida.AGUARDANDO,
      }),
    );
  }

  /**
   * Cria um time novo com os jogadores de linha que entram, mais os goleiros
   * fixos herdados do time que saiu daquele lado.
   */
  private async criarTime(
    gerenciador: EntityManager,
    peladaId: string,
    ordemCriacao: number,
    jogadores: JogadorRotacao[],
    goleirosFixos: string[] = [],
  ): Promise<TimeEntity> {
    const time = await gerenciador.save(
      gerenciador.create(TimeEntity, {
        peladaId,
        nome: `Time ${ordemCriacao}`,
        cor: null,
        ordemCriacao,
        partidasConsecutivas: 0,
        vitoriasConsecutivas: 0,
        ativo: true,
        dissolvidoEm: null,
      }),
    );

    // `jogadores` chega na ordem da fila, e e essa ordem que `ordemEntrada`
    // guarda: e o que devolve cada um para o lugar certo quando o time perder.
    const elenco = [
      ...jogadores.map((j) => ({ participanteId: j.id, ehGoleiro: false })),
      ...goleirosFixos.map((id) => ({ participanteId: id, ehGoleiro: true })),
    ];

    await gerenciador.save(
      elenco.map((membro, indice) =>
        gerenciador.create(JogadorTimeEntity, {
          timeId: time.id,
          participanteId: membro.participanteId,
          ehGoleiro: membro.ehGoleiro,
          ordemEntrada: indice,
          ativo: true,
          saiuEm: null,
        }),
      ),
    );

    return time;
  }

  /**
   * Monta a visão de domínio do time, separando goleiros fixos.
   *
   * `jogadores` traz só quem entra na rotação — o goleiro fixo fica de fora,
   * porque pela regra da pelada ele não vai para a fila nem é sorteado. Os
   * goleiros saem por `goleirosPorTime`, para que o time que assumir aquele
   * lado os herde.
   */
  private async montarTimeRotacao(
    gerenciador: EntityManager,
    timeId: string,
    goleirosPorTime: Map<string, string[]>,
    jogadasPorParticipante: Map<string, number>,
  ): Promise<TimeRotacao> {
    const time = await gerenciador.findOneByOrFail(TimeEntity, { id: timeId });
    // A ordem importa e por isso e pedida ao banco. Sem `ORDER BY` o Postgres
    // devolve na ordem que quiser, e o time voltava para a fila embaralhado —
    // `MotorPelada.rotacionar` recebe este elenco como a ordem de fila que
    // essas pessoas tinham quando entraram.
    const elenco = await gerenciador.find(JogadorTimeEntity, {
      where: { timeId, ativo: true },
      order: { ordemEntrada: 'ASC', entrouEm: 'ASC' },
    });
    const participantes = elenco.length
      ? await gerenciador.find(ParticipantePeladaEntity, {
          where: elenco.map((e) => ({ id: e.participanteId })),
        })
      : [];

    const porId = new Map(participantes.map((p) => [p.id, p]));
    // Percorre o elenco, e nao o resultado da consulta de participantes: e o
    // elenco que esta ordenado.
    const disponiveis = elenco
      .map((membro) => porId.get(membro.participanteId))
      .filter(
        (p): p is ParticipantePeladaEntity =>
          p !== undefined && p.status !== StatusParticipantePelada.DESCANSANDO,
      );
    const fixos = disponiveis.filter((p) => p.ehGoleiroFixo);
    goleirosPorTime.set(
      time.id,
      fixos.map((p) => p.id),
    );

    return {
      id: time.id,
      partidasConsecutivas: time.partidasConsecutivas,
      vitoriasConsecutivas: time.vitoriasConsecutivas,
      jogadores: disponiveis
        .filter((p) => !p.ehGoleiroFixo)
        .map((p) => ({
          id: p.id,
          ordemChegada: p.ordemChegada ?? Number.MAX_SAFE_INTEGER,
          partidasJogadas: jogadasPorParticipante.get(p.id) ?? 0,
        })),
    };
  }

  /**
   * Fim da fila interna do time — para quem entra sem herdar vaga de ninguem.
   *
   * Conta os inativos junto de proposito: reaproveitar o numero de alguem que
   * ja saiu poria dois jogadores no mesmo lugar da fila quando o time voltasse.
   */
  private async proximaOrdemEntrada(
    gerenciador: EntityManager,
    timeId: string,
  ): Promise<number> {
    const { maximo } = (await gerenciador
      .createQueryBuilder(JogadorTimeEntity, 'membro')
      .select('MAX(membro.ordem_entrada)', 'maximo')
      .where('membro.time_id = :timeId', { timeId })
      .getRawOne<{ maximo: number | null }>()) ?? { maximo: null };
    return (maximo ?? -1) + 1;
  }

  /**
   * Quantas partidas desta edicao cada participante ja jogou.
   *
   * E o criterio de quem fica quando a fila nao fecha o time. Uma consulta
   * agregada, e nao uma por jogador: a rotacao acontece a cada partida.
   */
  private async contarPartidasJogadas(
    gerenciador: EntityManager,
    peladaId: string,
  ): Promise<Map<string, number>> {
    const linhas = await gerenciador
      .createQueryBuilder(ParticipacaoPartidaEntity, 'participacao')
      .innerJoin(
        PartidaEntity,
        'partida',
        'partida.id = participacao.partida_id',
      )
      .where('partida.pelada_id = :peladaId', { peladaId })
      .select('participacao.participante_id', 'participanteId')
      .addSelect('COUNT(*)', 'total')
      .groupBy('participacao.participante_id')
      .getRawMany<{ participanteId: string; total: string }>();

    return new Map(linhas.map((l) => [l.participanteId, Number(l.total)]));
  }

  private async montarFila(
    gerenciador: EntityManager,
    peladaId: string,
    jogadasPorParticipante: Map<string, number>,
  ): Promise<JogadorRotacao[]> {
    const fila = await gerenciador.find(FilaJogadorEntity, {
      where: { peladaId, ativo: true },
      order: { posicao: 'ASC' },
    });
    if (!fila.length) return [];

    const participantes = await gerenciador.find(ParticipantePeladaEntity, {
      where: fila.map((f) => ({ id: f.participanteId })),
    });
    const ordemPorId = new Map(
      participantes.map((p) => [
        p.id,
        p.ordemChegada ?? Number.MAX_SAFE_INTEGER,
      ]),
    );

    return fila.map((f) => ({
      id: f.participanteId,
      ordemChegada: ordemPorId.get(f.participanteId) ?? Number.MAX_SAFE_INTEGER,
      partidasJogadas: jogadasPorParticipante.get(f.participanteId) ?? 0,
    }));
  }

  /**
   * Carrega a partida ja restrita ao organizador autenticado, numa consulta so.
   *
   * A posse entra como criterio do WHERE, e nao como checagem posterior, para
   * que "partida inexistente" e "partida de outro organizador" respondam o
   * mesmo 404. Separar as duas mensagens revelaria quais ids existem.
   */
  private async buscar(usuarioId: string, id: string) {
    const p = await this.partidas
      .createQueryBuilder('partida')
      .innerJoin(PeladaEntity, 'pelada', 'pelada.id = partida.peladaId')
      .where('partida.id = :id', { id })
      .andWhere('pelada.organizadorId = :usuarioId', { usuarioId })
      .getOne();
    if (!p) throw new NotFoundException('Partida nao encontrada');
    return p;
  }
}
