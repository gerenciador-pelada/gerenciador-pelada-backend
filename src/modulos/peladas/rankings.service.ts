import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { PontuacaoJogadorEntity } from '../../banco/entidades/pontuacao-jogador.entity';
import { AcessoPeladaService } from './acesso-pelada.service';

@Injectable()
export class RankingsService {
  constructor(
    @InjectRepository(PontuacaoJogadorEntity)
    private readonly pontuacoes: Repository<PontuacaoJogadorEntity>,
    private readonly acesso: AcessoPeladaService,
  ) {}

  /**
   * Ranking agregado das peladas do organizador autenticado.
   *
   * O innerJoin com peladas nao e opcional: sem ele a agregacao somaria a
   * pontuacao de todos os organizadores do sistema numa unica tabela.
   */
  async listar(usuarioId: string, peladaId?: string) {
    if (peladaId) {
      await this.acesso.garantirPelada(usuarioId, peladaId);
    }

    const q = this.pontuacoes
      .createQueryBuilder('p')
      .innerJoin(PeladaEntity, 'pelada', 'pelada.id = p.peladaId')
      .select('p.jogadorId', 'jogadorId')
      .addSelect('SUM(p.pontosTotal)', 'pontuacao')
      .addSelect('SUM(p.pontosGols)', 'gols')
      .addSelect('SUM(p.pontosAssistencias)', 'assistencias')
      .addSelect('SUM(p.pontosBolaCheia)', 'bolasCheias')
      .addSelect('SUM(p.pontosBolaMurcha)', 'bolasMurchas')
      .where('pelada.organizadorId = :usuarioId', { usuarioId })
      .groupBy('p.jogadorId')
      .orderBy('SUM(p.pontosTotal)', 'DESC');

    if (peladaId) q.andWhere('p.peladaId = :peladaId', { peladaId });

    return q.getRawMany();
  }
}
