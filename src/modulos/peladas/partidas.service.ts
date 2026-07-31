import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
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
      const idsElenco = new Set(elenco.map((membro) => membro.participanteId));
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
          ...elenco.map((membro) => ({
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

      // Sai do time e da partida, guardando quando saiu.
      const agora = new Date();
      if (participacaoSai) {
        await gerenciador.update(
          ParticipacaoPartidaEntity,
          participacaoSai.id,
          { saiuEm: agora },
        );
      }
      if (membroSai) {
        await gerenciador.update(JogadorTimeEntity, membroSai.id, {
          ativo: false,
          saiuEm: agora,
        });
      }

      // Entra no time e na partida, herdando o papel.
      await gerenciador.save(
        gerenciador.create(JogadorTimeEntity, {
          timeId,
          participanteId: entraId,
          ehGoleiro,
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

      // Quem entrou sai da fila. Quem estava em campo vai para o fim; quem ja
      // estava temporariamente FORA continua descansando, sem mexer na fila.
      await gerenciador.update(
        FilaJogadorEntity,
        { peladaId: partida.peladaId, participanteId: entraId, ativo: true },
        { ativo: false, saiuEm: agora },
      );
      if (!estavaDescansando) {
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
    const casa = await this.montarTimeRotacao(
      gerenciador,
      partida.timeCasaId,
      goleirosPorTime,
    );
    const visitante = await this.montarTimeRotacao(
      gerenciador,
      partida.timeVisitanteId,
      goleirosPorTime,
    );
    const fila = await this.montarFila(gerenciador, partida.peladaId);

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

    // Goleiro fixo nao entra na rotacao: ele fica no gol e o time que assume o
    // lado dele herda o goleiro. Sem isto o goleiro era dissolvido junto com o
    // time perdedor e caia na fila como jogador de linha.
    const goleirosLiberados = saem.map((t) => goleirosPorTime.get(t.id) ?? []);

    const jogadoresQueSaem = saem.flatMap((t) => t.jogadores);
    const tamanhoTime = configuracao.jogadoresLinhaPorTime;
    const vagas = permanece ? tamanhoTime : tamanhoTime * 2;

    const daFila = fila.slice(0, vagas);
    const complemento = [...jogadoresQueSaem]
      .sort((a, b) => a.ordemChegada - b.ordemChegada)
      .slice(0, Math.max(0, vagas - daFila.length));
    const entram = [...daFila, ...complemento];

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
      const venceu = !empatou;
      await gerenciador.update(TimeEntity, permanece.id, {
        partidasConsecutivas: permanece.partidasConsecutivas + 1,
        vitoriasConsecutivas: venceu
          ? (permanece.vitoriasConsecutivas ?? 0) + 1
          : 0,
      });
    }

    // Quem ja esperava mantem a posicao que tinha; quem sai de campo entra
    // atras de todos eles.
    //
    // Antes isto reordenava a fila inteira por `ordemChegada`, o que anulava
    // a espera: quem chegou cedo voltava para a frente por mais recente que
    // tivesse jogado, e quem chegou tarde ficava preso no fim para sempre —
    // o grupo "depois deles" nunca entrava. A fila e uma fila: o que da a vez
    // e ha quanto tempo a pessoa esta parada, nao a que horas ela chegou.
    //
    // `ordemChegada` continua valendo, mas so para desempatar entre os que
    // saem juntos do mesmo time.
    const sobra = [
      ...fila.slice(daFila.length),
      ...jogadoresQueSaem
        .filter((j) => !complemento.some((c) => c.id === j.id))
        .sort((a, b) => a.ordemChegada - b.ordemChegada),
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

    const elenco = [
      ...jogadores.map((j) => ({ participanteId: j.id, ehGoleiro: false })),
      ...goleirosFixos.map((id) => ({ participanteId: id, ehGoleiro: true })),
    ];

    await gerenciador.save(
      elenco.map((membro) =>
        gerenciador.create(JogadorTimeEntity, {
          timeId: time.id,
          participanteId: membro.participanteId,
          ehGoleiro: membro.ehGoleiro,
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
  ): Promise<TimeRotacao> {
    const time = await gerenciador.findOneByOrFail(TimeEntity, { id: timeId });
    const elenco = await gerenciador.find(JogadorTimeEntity, {
      where: { timeId, ativo: true },
    });
    const participantes = elenco.length
      ? await gerenciador.find(ParticipantePeladaEntity, {
          where: elenco.map((e) => ({ id: e.participanteId })),
        })
      : [];

    const disponiveis = participantes.filter(
      (p) => p.status !== StatusParticipantePelada.DESCANSANDO,
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
        })),
    };
  }

  private async montarFila(
    gerenciador: EntityManager,
    peladaId: string,
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
