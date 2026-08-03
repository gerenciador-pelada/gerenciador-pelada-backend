import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { TimeEntity } from '../../banco/entidades/time.entity';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';

/** Eventos que a tela de correcao mostra e edita. Entrada, saida e lesao ficam
 *  de fora: sao registro de movimentacao, nao de desempenho. */
const EVENTOS_DE_DESEMPENHO = [
  TipoEventoPartida.GOL,
  TipoEventoPartida.GOL_CONTRA,
  TipoEventoPartida.BOLA_CHEIA,
  TipoEventoPartida.BOLA_MURCHA,
];

/**
 * Todas as partidas de uma edicao, com quem fez o que em cada uma.
 *
 * Existe separado do painel porque responde outra pergunta: o painel mostra o
 * confronto de agora, e esta consulta mostra a edicao inteira para conferir e
 * corrigir depois. Carregar as duas coisas juntas faria a tela da partida
 * pagar por um dado que ela nao usa.
 */
@Injectable()
export class PartidasDaPeladaService {
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
    @InjectRepository(EventoPartidaEntity)
    private readonly eventos: Repository<EventoPartidaEntity>,
  ) {}

  async listar(usuarioId: string, peladaId: string) {
    // A posse entra no WHERE: pelada inexistente e pelada de outro organizador
    // respondem o mesmo 404, sem revelar quais ids existem.
    const pelada = await this.peladas.findOne({
      where: { id: peladaId, organizadorId: usuarioId },
    });
    if (!pelada) throw new NotFoundException('Pelada nao encontrada');

    const partidas = await this.partidas.find({
      where: { peladaId },
      order: { numero: 'ASC' },
    });
    if (partidas.length === 0) return { pelada: this.mapearPelada(pelada), partidas: [] };

    const participantes = await this.participantes.find({
      where: { peladaId },
      relations: ['jogador'],
    });
    const nomeDe = new Map(
      participantes.map((p) => [p.id, p.jogador?.apelido ?? p.jogador?.nome ?? '—']),
    );

    const idsTimes = [
      ...new Set(partidas.flatMap((p) => [p.timeCasaId, p.timeVisitanteId])),
    ];
    const times = await this.times.find({ where: { id: In(idsTimes) } });
    const timePorId = new Map(times.map((t) => [t.id, t]));

    // Uma consulta so para todos os elencos e outra para todos os eventos: uma
    // por partida faria N+1 numa tela que lista a edicao inteira.
    const elencos = await this.elencos.find({
      where: { timeId: In(idsTimes) },
    });
    const eventos = await this.eventos.find({
      where: {
        partidaId: In(partidas.map((p) => p.id)),
        tipo: In(EVENTOS_DE_DESEMPENHO),
      },
      order: { criadoEm: 'ASC' },
    });

    return {
      pelada: this.mapearPelada(pelada),
      partidas: partidas.map((partida) => ({
        id: partida.id,
        numero: partida.numero,
        status: partida.status,
        // Lancamento manual tem o mesmo time dos dois lados. Um sorteio de
        // verdade sempre cria dois, entao a forma basta para reconhece-lo — e
        // a tela precisa saber, porque corrigir evento a evento nao serve
        // para ele: os pontos foram digitados e seriam recalculados por cima.
        ehLancamentoManual: partida.timeCasaId === partida.timeVisitanteId,
        golsCasa: partida.golsCasa,
        golsVisitante: partida.golsVisitante,
        iniciadaEm: partida.iniciadaEm?.toISOString() ?? null,
        finalizadaEm: partida.finalizadaEm?.toISOString() ?? null,
        timeCasa: this.mapearTime(
          partida.timeCasaId,
          timePorId,
          elencos,
          nomeDe,
        ),
        timeVisitante: this.mapearTime(
          partida.timeVisitanteId,
          timePorId,
          elencos,
          nomeDe,
        ),
        eventos: eventos
          .filter((e) => e.partidaId === partida.id)
          .map((e) => ({
            id: e.id,
            tipo: e.tipo,
            timeId: e.timeId,
            participanteId: e.participanteId,
            nome: nomeDe.get(e.participanteId) ?? '—',
            participanteRelacionadoId: e.participanteRelacionadoId,
            nomeRelacionado: e.participanteRelacionadoId
              ? (nomeDe.get(e.participanteRelacionadoId) ?? null)
              : null,
          })),
      })),
    };
  }

  private mapearPelada(pelada: PeladaEntity) {
    return { id: pelada.id, nome: pelada.nome, status: pelada.status };
  }

  /**
   * O elenco vem do registro do time, nao da participacao da partida: a tela
   * precisa oferecer todo mundo que esteve naquele time para receber o gol
   * esquecido, inclusive quem entrou como substituto.
   */
  private mapearTime(
    timeId: string,
    timePorId: Map<string, TimeEntity>,
    elencos: JogadorTimeEntity[],
    nomeDe: Map<string, string>,
  ) {
    const time = timePorId.get(timeId);
    if (!time) return null;
    return {
      id: time.id,
      nome: time.nome,
      cor: time.cor,
      jogadores: elencos
        .filter((membro) => membro.timeId === timeId)
        .map((membro) => ({
          participanteId: membro.participanteId,
          nome: nomeDe.get(membro.participanteId) ?? '—',
        })),
    };
  }
}
