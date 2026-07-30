import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { TimeEntity } from '../../banco/entidades/time.entity';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';

export interface JogadorPainel {
  participanteId: string;
  nome: string;
  apelido: string | null;
  ehGoleiro: boolean;
  ordemChegada: number | null;
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

    const times = partidaDeReferencia
      ? await this.montarTimes(partidaDeReferencia, porParticipante)
      : { casa: null, visitante: null };

    const eventos = partidaDeReferencia
      ? await this.eventos.find({
          where: { partidaId: partidaDeReferencia.id },
          order: { criadoEm: 'DESC' },
          take: 10,
        })
      : [];

    const registrosFila = await this.fila.find({
      where: { peladaId, ativo: true },
      order: { posicao: 'ASC' },
    });

    return {
      pelada: {
        id: pelada.id,
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
        this.mapearJogador(porParticipante.get(f.participanteId), false),
      ),
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
      finalizadaEm: partida.finalizadaEm,
      vencedorDecisao: partida.vencedorDecisao ?? null,
    };
  }

  private async montarTimes(
    partida: PartidaEntity,
    porParticipante: Map<string, ParticipantePeladaEntity>,
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
      return {
        id: time.id,
        nome: time.nome,
        cor: time.cor,
        vitoriasConsecutivas: time.vitoriasConsecutivas,
        jogadores: elenco
          .filter((e) => e.timeId === timeId)
          .map((e) =>
            this.mapearJogador(
              porParticipante.get(e.participanteId),
              e.ehGoleiro,
            ),
          ),
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
  ): JogadorPainel {
    return {
      participanteId: participante?.id ?? '',
      nome: participante?.jogador?.nome ?? 'Desconhecido',
      apelido: participante?.jogador?.apelido ?? null,
      ehGoleiro,
      ordemChegada: participante?.ordemChegada ?? null,
    };
  }
}
