import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { LinhaRanking, RankingsService } from './rankings.service';

export interface RankingPublico {
  pelada: { nome: string; data: Date };
  ranking: LinhaRanking[];
}

/**
 * Link somente-leitura do ranking, para quem joga mas nao tem conta.
 *
 * Os jogadores da pelada nao sao usuarios do sistema — so o organizador e.
 * Obrigar cada um a criar conta para ver a classificacao seria atrito sem
 * contrapartida, ainda mais com o cadastro fechado por convite.
 *
 * O token vai na URL, entao acaba no historico do navegador e na previa de
 * link do WhatsApp: vale como segredo fraco. Por isso e descartavel — revogar
 * e apagar o valor — e por isso da acesso apenas a classificacao, nunca a
 * dados do organizador ou de contato de ninguem.
 */
@Injectable()
export class RankingPublicoService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    private readonly rankings: RankingsService,
  ) {}

  /**
   * Cria o link, ou devolve o que ja existe.
   *
   * Nao regenera a cada chamada: o organizador ja mandou o link no grupo, e
   * trocar o token por um toque acidental quebraria o link de todo mundo.
   * Para trocar de proposito existe `revogar` e depois gerar de novo.
   */
  async gerar(usuarioId: string, peladaId: string): Promise<string> {
    const pelada = await this.carregar(usuarioId, peladaId);
    if (pelada.tokenPublico) return pelada.tokenPublico;

    const token = randomBytes(16).toString('base64url');
    await this.peladas.update(pelada.id, { tokenPublico: token });
    return token;
  }

  async revogar(usuarioId: string, peladaId: string): Promise<void> {
    const pelada = await this.carregar(usuarioId, peladaId);
    await this.peladas.update(pelada.id, { tokenPublico: null });
  }

  /**
   * Resolve o ranking a partir do token, sem nenhuma autenticacao.
   *
   * O ranking e montado com o `organizadorId` da propria pelada: o visitante
   * nao tem identidade no sistema, e ainda assim a consulta continua escopada
   * a uma pelada so — o token nao amplia o alcance de quem o possui.
   */
  async porToken(token: string): Promise<RankingPublico> {
    const pelada = await this.peladas.findOne({
      where: { tokenPublico: token, deletadoEm: IsNull() },
    });
    // 404 e nao 403: um 403 confirmaria que aquele token ja existiu, o que
    // ajuda quem esta chutando valores.
    if (!pelada) throw new NotFoundException('Link nao encontrado');

    return {
      pelada: { nome: pelada.nome, data: pelada.dataHora },
      ranking: await this.rankings.listar(pelada.organizadorId, pelada.id),
    };
  }

  private async carregar(
    usuarioId: string,
    peladaId: string,
  ): Promise<PeladaEntity> {
    const pelada = await this.peladas.findOne({
      where: { id: peladaId, organizadorId: usuarioId, deletadoEm: IsNull() },
    });
    if (!pelada) throw new NotFoundException('Pelada nao encontrada');
    return pelada;
  }
}
