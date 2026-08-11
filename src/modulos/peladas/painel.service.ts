import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { TimeEntity } from '../../banco/entidades/time.entity';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';

export interface JogadorPainel {
  participanteId: string;
  nome: string;
  apelido: string | null;
  ehGoleiro: boolean;
  ehGoleiroTemporario: boolean;
  ordemChegada: number | null;
  descansando: boolean;
  substituiParticipanteId: string | null;
  substituiNome: string | null;
  /**
   * Quantas partidas desta edicao a pessoa ja jogou. E o criterio da rotacao
   * quando a fila nao fecha o time — `ordemChegada` so diz a que horas ela
   * apareceu na pelada.
   */
  partidasJogadas: number;
}

export interface TimePainel {
  id: string;
  nome: string;
  cor: string | null;
  vitoriasConsecutivas: number;
  jogadores: JogadorPainel[];
}

/**
 * Estado completo da tela principal da pelada, numa consulta so.
 *
 * A tela e usada no celular ao lado do campo: uma unica chamada evita que
 * placar, times e fila apareçam dessincronizados entre si enquanto varias
 * requisicoes chegam fora de ordem.
 */
@Injectable()
export class PainelService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    @InjectRepository(PartidaEntity)
    private readonly partidas: Repository<PartidaEntity>,
    @InjectRepository(TimeEntity)
    private readonly times: Repository<TimeEntity>,
    @InjectRepository(JogadorTimeEntity)
    private readonly elencos: Repository<JogadorTimeEntity>,
    @InjectRepository(ParticipantePeladaEntity)
    private readonly participantes: Repository<ParticipantePeladaEntity>,
    @InjectRepository(FilaJogadorEntity)
    private readonly fila: Repository<FilaJogadorEntity>,
    @InjectRepository(EventoPartidaEntity)
    private readonly eventos: Repository<EventoPartidaEntity>,
    @InjectRepository(ParticipacaoPartidaEntity)
    private readonly participacoes: Repository<ParticipacaoPartidaEntity>,
  ) {}

  async montar(usuarioId: string, peladaId: string) {
    const pelada = await this.peladas.findOne({
      where: { id: peladaId, organizadorId: usuarioId },
      relations: ['configuracao', 'local'],
    });
    if (!pelada) throw new NotFoundException('Pelada nao encontrada');

    const participantes = await this.participantes.find({
      where: { peladaId },
      relations: ['jogador'],
    });
    const porParticipante = new Map(participantes.map((p) => [p.id, p]));

    const partidaAtual = await this.partidas.findOne({
      where: [
        { peladaId, status: StatusPartida.EM_ANDAMENTO },
        { peladaId, status: StatusPartida.AGUARDANDO },
      ],
      order: { numero: 'ASC' },
    });

    const ultimaPartida =
      pelada.status === StatusPelada.FINALIZADA
        ? await this.partidas.findOne({
            where: { peladaId, status: StatusPartida.FINALIZADA },
            order: { numero: 'DESC' },
          })
        : null;
    const partidaDeReferencia = partidaAtual ?? ultimaPartida;

    // Quantas partidas cada um ja jogou: e o criterio de quem fica quando a
    // fila nao fecha o time, e a tela de encerrar precisa dele para prever
    // corretamente quem sai.
    const jogadasPorParticipante = await this.contarPartidasJogadas(peladaId);

    const times = partidaDeReferencia
      ? await this.montarTimes(
          partidaDeReferencia,
          porParticipante,
          jogadasPorParticipante,
        )
      : { casa: null, visitante: null };
    const idsNosTimes = new Set(
      [
        ...(times.casa?.jogadores ?? []),
        ...(times.visitante?.jogadores ?? []),
      ].map((jogador) => jogador.participanteId),
    );

    const eventos = partidaDeReferencia
      ? await this.eventos.find({
          where: { partidaId: partidaDeReferencia.id },
          order: { criadoEm: 'DESC' },
          take: 10,
        })
      : [];

    /**
     * Gols e assistencias de cada um NESTA partida.
     *
     * Consulta separada de `eventos` de proposito. Aquela e a lista "agora ha
     * pouco" e por isso tem `take: 10`; se a contagem saisse dela, o decimo
     * primeiro gol da partida sumiria do placar ao lado do nome.
     *
     * Vai por id, e nao por nome: o cartao mostra `apelido ?? nome`, e casar
     * texto erraria justamente em quem tem apelido.
     */
    const todosOsEventos = partidaDeReferencia
      ? await this.eventos.find({
          where: { partidaId: partidaDeReferencia.id },
          select: { tipo: true, participanteId: true, participanteRelacionadoId: true },
        })
      : [];

    const numerosDaPartida = new Map<string, { gols: number; assistencias: number }>();
    const acumular = (id: string, campo: 'gols' | 'assistencias') => {
      const atual = numerosDaPartida.get(id) ?? { gols: 0, assistencias: 0 };
      atual[campo] += 1;
      numerosDaPartida.set(id, atual);
    };
    for (const evento of todosOsEventos) {
      if (evento.tipo !== TipoEventoPartida.GOL) continue;
      acumular(evento.participanteId, 'gols');
      if (evento.participanteRelacionadoId)
        acumular(evento.participanteRelacionadoId, 'assistencias');
    }

    const registrosFila = await this.fila.find({
      where: { peladaId, ativo: true },
      order: { posicao: 'ASC' },
    });

    return {
      pelada: {
        id: pelada.id,
        // O grupo e o que permite a tela oferecer o recorte "esta pelada"
        // — todas as edicoes somadas — sem uma consulta so para descobri-lo.
        grupoId: pelada.grupoId,
        nome: pelada.nome,
        status: pelada.status,
        local: pelada.local?.nome ?? null,
        jogadoresLinhaPorTime: pelada.configuracao.jogadoresLinhaPorTime,
        duracaoPartidaMinutos: pelada.configuracao.duracaoPartidaMinutos,
        maximoGols: pelada.configuracao.maximoGols,
        permiteEmpate: pelada.configuracao.permiteEmpate,
        regraEmpate: pelada.configuracao.regraEmpate,
      },
      partidaAtual: this.mapearPartida(partidaAtual),
      ultimaPartida: this.mapearPartida(ultimaPartida),
      timeCasa: times.casa,
      timeVisitante: times.visitante,
      fila: registrosFila.map((f) =>
        this.mapearJogador(porParticipante.get(f.participanteId), false, false),
      ),
      // Quem saiu por agora nao esta em campo nem na fila. Sem esta lista ele
      // sumia da tela por inteiro, e o organizador nao tinha como traze-lo de
      // volta — numa prancheta, o que nao aparece nao pode ser gerenciado.
      descansando: participantes
        .filter(
          (p) =>
            p.status === StatusParticipantePelada.DESCANSANDO &&
            !idsNosTimes.has(p.id),
        )
        .map((p) => this.mapearJogador(p, false, false)),
      eventosRecentes: eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        minuto: e.minuto,
        jogador:
          porParticipante.get(e.participanteId)?.jogador?.nome ??
          'Desconhecido',
        assistente: e.participanteRelacionadoId
          ? (porParticipante.get(e.participanteRelacionadoId)?.jogador?.nome ??
            null)
          : null,
      })),
      numerosDaPartida: [...numerosDaPartida.entries()].map(
        ([participanteId, n]) => ({ participanteId, ...n }),
      ),
      totalPresentes: participantes.filter((p) => p.ordemChegada !== null)
        .length,
      // Separado de propósito: o sorteio exige jogadores de LINHA, e contar
      // goleiros fixos junto fazia a tela dizer "há 14 de 12" enquanto o
      // sorteio recusava por falta de gente.
      totalLinhaPresentes: participantes.filter(
        (p) => p.ordemChegada !== null && !p.ehGoleiroFixo,
      ).length,
    };
  }

  private mapearPartida(partida: PartidaEntity | null) {
    if (!partida) return null;
    return {
      id: partida.id,
      numero: partida.numero,
      status: partida.status,
      golsCasa: partida.golsCasa,
      golsVisitante: partida.golsVisitante,
      iniciadaEm: partida.iniciadaEm,
      // Sem estes dois o front nao tem como saber que o relogio esta parado,
      // nem quanto ja correu antes da pausa — ele contaria do zero e a pausa
      // seria invisivel para quem abrir a tela depois.
      pausadaEm: partida.pausadaEm,
      segundosAcumulados: partida.segundosAcumulados,
      finalizadaEm: partida.finalizadaEm,
      vencedorDecisao: partida.vencedorDecisao ?? null,
    };
  }

  private async contarPartidasJogadas(
    peladaId: string,
  ): Promise<Map<string, number>> {
    const linhas = await this.participacoes
      .createQueryBuilder('participacao')
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

  private async montarTimes(
    partida: PartidaEntity,
    porParticipante: Map<string, ParticipantePeladaEntity>,
    jogadasPorParticipante: Map<string, number>,
  ): Promise<{ casa: TimePainel | null; visitante: TimePainel | null }> {
    const times = await this.times.find({
      where: [{ id: partida.timeCasaId }, { id: partida.timeVisitanteId }],
    });
    const elenco = await this.elencos.find({
      where: [
        { timeId: partida.timeCasaId, ativo: true },
        { timeId: partida.timeVisitanteId, ativo: true },
      ],
    });

    const montar = (timeId: string): TimePainel | null => {
      const time = times.find((t) => t.id === timeId);
      if (!time) return null;
      const jogadores = elenco
        .filter((e) => e.timeId === timeId)
        .map((e) =>
          this.mapearJogador(
            porParticipante.get(e.participanteId),
            e.ehGoleiro,
            false,
            e.substituiParticipanteId ?? null,
            e.substituiParticipanteId
              ? porParticipante.get(e.substituiParticipanteId)
              : undefined,
            jogadasPorParticipante.get(e.participanteId) ?? 0,
          ),
        );
      const goleiroTemporarioId =
        timeId === partida.timeCasaId
          ? partida.goleiroCasaId
          : partida.goleiroVisitanteId;
      if (
        goleiroTemporarioId &&
        !jogadores.some(
          (jogador) => jogador.participanteId === goleiroTemporarioId,
        )
      ) {
        jogadores.push(
          this.mapearJogador(
            porParticipante.get(goleiroTemporarioId),
            true,
            true,
          ),
        );
      }

      return {
        id: time.id,
        nome: time.nome,
        cor: time.cor,
        vitoriasConsecutivas: time.vitoriasConsecutivas,
        jogadores,
      };
    };

    return {
      casa: montar(partida.timeCasaId),
      visitante: montar(partida.timeVisitanteId),
    };
  }

  private mapearJogador(
    participante: ParticipantePeladaEntity | undefined,
    ehGoleiro: boolean,
    ehGoleiroTemporario: boolean,
    substituiParticipanteId: string | null = null,
    substituido?: ParticipantePeladaEntity,
    partidasJogadas = 0,
  ): JogadorPainel {
    return {
      participanteId: participante?.id ?? '',
      nome: participante?.jogador?.nome ?? 'Desconhecido',
      apelido: participante?.jogador?.apelido ?? null,
      ehGoleiro,
      ehGoleiroTemporario,
      ordemChegada: participante?.ordemChegada ?? null,
      descansando:
        participante?.status === StatusParticipantePelada.DESCANSANDO,
      substituiParticipanteId,
      substituiNome: substituido?.jogador?.nome ?? null,
      partidasJogadas,
    };
  }
}
