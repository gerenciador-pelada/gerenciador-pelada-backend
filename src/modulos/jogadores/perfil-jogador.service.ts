import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { PontuacaoJogadorEntity } from '../../banco/entidades/pontuacao-jogador.entity';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';

export interface PerfilJogador {
  jogador: {
    id: string;
    nome: string;
    apelido: string | null;
    posicaoPreferida: string;
    podeSerGoleiro: boolean;
  };
  partidas: number;
  pontuacao: number;
  gols: number;
  assistencias: number;
  bolasCheias: number;
  bolasMurchas: number;
  peladas: number;
}

interface LinhaTotais {
  partidas: string | null;
  pontuacao: string | null;
  peladas: string | null;
}

interface LinhaContagem {
  tipo: TipoEventoPartida;
  total: string;
}

const paraNumero = (v: string | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);

/**
 * Perfil individual do jogador.
 *
 * Mesma separacao usada no ranking: a pontuacao sai de PontuacaoJogador, ja
 * ponderada pelas regras de cada pelada, e as contagens de gol, assistencia e
 * bola saem dos eventos. Derivar contagem de pontuacao daria zero sempre que a
 * pelada nao pontuar aquele evento, que e o padrao.
 *
 * Tudo restrito as peladas do organizador autenticado.
 */
@Injectable()
export class PerfilJogadorService {
  constructor(
    @InjectRepository(JogadorEntity)
    private readonly jogadores: Repository<JogadorEntity>,
    @InjectRepository(PontuacaoJogadorEntity)
    private readonly pontuacoes: Repository<PontuacaoJogadorEntity>,
    @InjectRepository(EventoPartidaEntity)
    private readonly eventos: Repository<EventoPartidaEntity>,
  ) {}

  async montar(usuarioId: string, jogadorId: string): Promise<PerfilJogador> {
    const jogador = await this.jogadores.findOne({
      where: { id: jogadorId, usuarioId },
    });
    if (!jogador) throw new NotFoundException('Jogador nao encontrado');

    const totais = await this.pontuacoes
      .createQueryBuilder('p')
      .innerJoin(PeladaEntity, 'pelada', 'pelada.id = p.peladaId')
      .select('COUNT(p.id)', 'partidas')
      .addSelect('COALESCE(SUM(p.pontosTotal), 0)', 'pontuacao')
      .addSelect('COUNT(DISTINCT p.peladaId)', 'peladas')
      .where('p.jogadorId = :jogadorId', { jogadorId })
      .andWhere('pelada.organizadorId = :usuarioId', { usuarioId })
      .getRawOne<LinhaTotais>();

    const [contagens, assistencias] = await Promise.all([
      this.contarEventos(usuarioId, jogadorId),
      this.contarAssistencias(usuarioId, jogadorId),
    ]);

    return {
      jogador: {
        id: jogador.id,
        nome: jogador.nome,
        apelido: jogador.apelido,
        posicaoPreferida: jogador.posicaoPreferida,
        podeSerGoleiro: jogador.podeSerGoleiro,
      },
      partidas: paraNumero(totais?.partidas),
      pontuacao: paraNumero(totais?.pontuacao),
      peladas: paraNumero(totais?.peladas),
      gols: contagens.get(TipoEventoPartida.GOL) ?? 0,
      assistencias,
      bolasCheias: contagens.get(TipoEventoPartida.BOLA_CHEIA) ?? 0,
      bolasMurchas: contagens.get(TipoEventoPartida.BOLA_MURCHA) ?? 0,
    };
  }

  private async contarEventos(
    usuarioId: string,
    jogadorId: string,
  ): Promise<Map<TipoEventoPartida, number>> {
    const linhas = await this.eventos
      .createQueryBuilder('e')
      .innerJoin(
        ParticipantePeladaEntity,
        'participante',
        'participante.id = e.participanteId',
      )
      .innerJoin(PeladaEntity, 'pelada', 'pelada.id = participante.peladaId')
      .select('e.tipo', 'tipo')
      .addSelect('COUNT(e.id)', 'total')
      .where('participante.jogadorId = :jogadorId', { jogadorId })
      .andWhere('pelada.organizadorId = :usuarioId', { usuarioId })
      .groupBy('e.tipo')
      .getRawMany<LinhaContagem>();

    return new Map(linhas.map((l) => [l.tipo, paraNumero(l.total)]));
  }

  private async contarAssistencias(
    usuarioId: string,
    jogadorId: string,
  ): Promise<number> {
    const linha = await this.eventos
      .createQueryBuilder('e')
      .innerJoin(
        ParticipantePeladaEntity,
        'participante',
        'participante.id = e.participanteRelacionadoId',
      )
      .innerJoin(PeladaEntity, 'pelada', 'pelada.id = participante.peladaId')
      .select('COUNT(e.id)', 'total')
      .where('participante.jogadorId = :jogadorId', { jogadorId })
      .andWhere('pelada.organizadorId = :usuarioId', { usuarioId })
      .andWhere('e.tipo = :tipo', { tipo: TipoEventoPartida.GOL })
      .getRawOne<{ total: string }>();

    return paraNumero(linha?.total);
  }
}
