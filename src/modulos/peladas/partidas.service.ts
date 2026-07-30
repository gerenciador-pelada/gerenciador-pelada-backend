import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { CalculadoraPontuacao } from '../../dominio/pelada/calculadora-pontuacao';
import {
  JogadorRotacao,
  MotorPelada,
  TimeRotacao,
} from '../../dominio/pelada/motor-pelada';

interface FinalizarOpcoes {
  vencedorDecisao?: 'CASA' | 'VISITANTE';
  escolhaAdmin?: 'CASA' | 'VISITANTE';
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

      await gerenciador.save(
        elenco.map((membro) =>
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

      await this.pontuar(gerenciador, partida, configuracao, empatou);

      partida.status = StatusPartida.FINALIZADA;
      partida.finalizadaEm = new Date();
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
    empatou: boolean,
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

    const timeVencedorId = empatou
      ? null
      : partida.golsCasa > partida.golsVisitante
        ? partida.timeCasaId
        : partida.timeVisitanteId;

    const contar = (participanteId: string, tipo: TipoEventoPartida) =>
      eventos.filter(
        (e) => e.participanteId === participanteId && e.tipo === tipo,
      ).length;

    const pontuacoes = participacoes.map((participacao) => {
      const resultado = empatou
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
        bolasMurchas: contar(
          participacao.participanteId,
          TipoEventoPartida.BOLA_MURCHA,
        ),
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

    const sobra = [
      ...fila.slice(daFila.length),
      ...jogadoresQueSaem.filter(
        (j) => !complemento.some((c) => c.id === j.id),
      ),
    ].sort((a, b) => a.ordemChegada - b.ordemChegada);

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

    const fixos = participantes.filter((p) => p.ehGoleiroFixo);
    goleirosPorTime.set(
      time.id,
      fixos.map((p) => p.id),
    );

    return {
      id: time.id,
      partidasConsecutivas: time.partidasConsecutivas,
      vitoriasConsecutivas: time.vitoriasConsecutivas,
      jogadores: participantes
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
