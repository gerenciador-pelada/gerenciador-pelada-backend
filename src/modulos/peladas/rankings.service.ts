import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { PontuacaoJogadorEntity } from '../../banco/entidades/pontuacao-jogador.entity';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { AcessoPeladaService } from './acesso-pelada.service';

export interface LinhaRanking {
  jogadorId: string;
  nome: string;
  apelido: string | null;
  pontuacao: number;
  partidas: number;
  gols: number;
  assistencias: number;
  bolasCheias: number;
  bolasMurchas: number;
}

interface LinhaPontuacao {
  jogadorId: string;
  nome: string;
  apelido: string | null;
  pontuacao: string | null;
  partidas: string | null;
}

interface LinhaContagem {
  jogadorId: string;
  tipo: TipoEventoPartida;
  total: string;
}

interface LinhaAssistencia {
  jogadorId: string;
  total: string;
}

const paraNumero = (valor: string | null | undefined): number =>
  valor === null || valor === undefined ? 0 : Number(valor);

@Injectable()
export class RankingsService {
  constructor(
    @InjectRepository(PontuacaoJogadorEntity)
    private readonly pontuacoes: Repository<PontuacaoJogadorEntity>,
    @InjectRepository(EventoPartidaEntity)
    private readonly eventos: Repository<EventoPartidaEntity>,
    private readonly acesso: AcessoPeladaService,
  ) {}

  /**
   * Ranking das peladas do organizador autenticado.
   *
   * Pontuacao e contagem sao coisas diferentes e por isso saem de duas
   * consultas: `PontuacaoJogador` guarda quanto cada um pontuou, ja ponderado
   * pelas regras da pelada; os gols, assistencias e bolas vem contados dos
   * eventos. Derivar a contagem da pontuacao daria zero sempre que a pelada
   * nao pontuar aquele evento — que e justamente o padrao.
   *
   * O innerJoin com peladas nao e opcional: sem ele a agregacao somaria a
   * pontuacao de todos os organizadores do sistema numa unica tabela.
   */
  async listar(usuarioId: string, peladaId?: string): Promise<LinhaRanking[]> {
    if (peladaId) {
      await this.acesso.garantirPelada(usuarioId, peladaId);
    }

    const pontuacao = this.pontuacoes
      .createQueryBuilder('p')
      .innerJoin(PeladaEntity, 'pelada', 'pelada.id = p.peladaId')
      .innerJoin(JogadorEntity, 'jogador', 'jogador.id = p.jogadorId')
      .select('p.jogadorId', 'jogadorId')
      .addSelect('jogador.nome', 'nome')
      .addSelect('jogador.apelido', 'apelido')
      .addSelect('SUM(p.pontosTotal)', 'pontuacao')
      .addSelect('COUNT(p.id)', 'partidas')
      .where('pelada.organizadorId = :usuarioId', { usuarioId })
      .groupBy('p.jogadorId')
      .addGroupBy('jogador.nome')
      .addGroupBy('jogador.apelido');

    if (peladaId) pontuacao.andWhere('p.peladaId = :peladaId', { peladaId });

    const linhas = await pontuacao.getRawMany<LinhaPontuacao>();
    if (linhas.length === 0) return [];

    const [contagens, assistencias] = await Promise.all([
      this.contarEventos(usuarioId, peladaId),
      this.contarAssistencias(usuarioId, peladaId),
    ]);

    return linhas
      .map((linha) => ({
        jogadorId: linha.jogadorId,
        nome: linha.nome,
        apelido: linha.apelido,
        pontuacao: paraNumero(linha.pontuacao),
        partidas: paraNumero(linha.partidas),
        gols: contagens.get(`${linha.jogadorId}:${TipoEventoPartida.GOL}`) ?? 0,
        assistencias: assistencias.get(linha.jogadorId) ?? 0,
        bolasCheias:
          contagens.get(`${linha.jogadorId}:${TipoEventoPartida.BOLA_CHEIA}`) ??
          0,
        bolasMurchas:
          contagens.get(
            `${linha.jogadorId}:${TipoEventoPartida.BOLA_MURCHA}`,
          ) ?? 0,
      }))
      .sort((a, b) => b.pontuacao - a.pontuacao || b.gols - a.gols);
  }

  /** Eventos em que o jogador e o protagonista, agrupados por tipo. */
  private async contarEventos(
    usuarioId: string,
    peladaId?: string,
  ): Promise<Map<string, number>> {
    const consulta = this.eventos
      .createQueryBuilder('e')
      .innerJoin(
        ParticipantePeladaEntity,
        'participante',
        'participante.id = e.participanteId',
      )
      .innerJoin(PeladaEntity, 'pelada', 'pelada.id = participante.peladaId')
      .select('participante.jogadorId', 'jogadorId')
      .addSelect('e.tipo', 'tipo')
      .addSelect('COUNT(e.id)', 'total')
      .where('pelada.organizadorId = :usuarioId', { usuarioId })
      .groupBy('participante.jogadorId')
      .addGroupBy('e.tipo');

    if (peladaId)
      consulta.andWhere('participante.peladaId = :peladaId', { peladaId });

    const linhas = await consulta.getRawMany<LinhaContagem>();
    return new Map(
      linhas.map((l) => [`${l.jogadorId}:${l.tipo}`, paraNumero(l.total)]),
    );
  }

  /** Assistencias sao gols em que o jogador figura como relacionado. */
  private async contarAssistencias(
    usuarioId: string,
    peladaId?: string,
  ): Promise<Map<string, number>> {
    const consulta = this.eventos
      .createQueryBuilder('e')
      .innerJoin(
        ParticipantePeladaEntity,
        'participante',
        'participante.id = e.participanteRelacionadoId',
      )
      .innerJoin(PeladaEntity, 'pelada', 'pelada.id = participante.peladaId')
      .select('participante.jogadorId', 'jogadorId')
      .addSelect('COUNT(e.id)', 'total')
      .where('pelada.organizadorId = :usuarioId', { usuarioId })
      .andWhere('e.tipo = :tipo', { tipo: TipoEventoPartida.GOL })
      .groupBy('participante.jogadorId');

    if (peladaId)
      consulta.andWhere('participante.peladaId = :peladaId', { peladaId });

    const linhas = await consulta.getRawMany<LinhaAssistencia>();
    return new Map(linhas.map((l) => [l.jogadorId, paraNumero(l.total)]));
  }
}
