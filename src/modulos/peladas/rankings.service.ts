import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PontuacaoJogadorEntity } from '../../banco/entidades/pontuacao-jogador.entity';
@Injectable()
export class RankingsService {
  constructor(
    @InjectRepository(PontuacaoJogadorEntity)
    private readonly pontuacoes: Repository<PontuacaoJogadorEntity>,
  ) {}
  listar(peladaId?: string) {
    const q = this.pontuacoes
      .createQueryBuilder('p')
      .select('p.jogadorId', 'jogadorId')
      .addSelect('SUM(p.pontosTotal)', 'pontuacao')
      .addSelect('SUM(p.pontosGols)', 'gols')
      .addSelect('SUM(p.pontosAssistencias)', 'assistencias')
      .addSelect('SUM(p.pontosBolaCheia)', 'bolasCheias')
      .addSelect('SUM(p.pontosBolaMurcha)', 'bolasMurchas')
      .groupBy('p.jogadorId')
      .orderBy('SUM(p.pontosTotal)', 'DESC');
    if (peladaId) q.where('p.peladaId=:peladaId', { peladaId });
    return q.getRawMany();
  }
}
