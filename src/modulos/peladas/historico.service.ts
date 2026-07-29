import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { HistoricoAcaoEntity } from '../../banco/entidades/historico-acao.entity';
import { AcessoPeladaService } from './acesso-pelada.service';
@Injectable()
export class HistoricoService {
  constructor(
    @InjectRepository(HistoricoAcaoEntity)
    private readonly historico: Repository<HistoricoAcaoEntity>,
    private readonly acesso: AcessoPeladaService,
  ) {}
  async listar(usuarioId: string, peladaId: string) {
    await this.acesso.garantirPelada(usuarioId, peladaId);
    return this.historico.find({
      where: { peladaId },
      order: { criadoEm: 'DESC' },
    });
  }
  async registrar(
    peladaId: string,
    usuarioId: string,
    acao: string,
    snapshotEstado: Record<string, unknown>,
  ) {
    return this.historico.save(
      this.historico.create({
        peladaId,
        usuarioId,
        acao,
        snapshotEstado,
        dadosAnteriores: null,
        dadosPosteriores: null,
        desfeitaEm: null,
      }),
    );
  }
  async desfazer(usuarioId: string, peladaId: string) {
    await this.acesso.garantirPelada(usuarioId, peladaId);
    const acao = await this.historico.findOne({
      where: { peladaId, desfeitaEm: IsNull() },
      order: { criadoEm: 'DESC' },
    });
    if (!acao) throw new NotFoundException('Nenhuma acao para desfazer');
    acao.desfeitaEm = new Date();
    await this.historico.save(acao);
    return acao.snapshotEstado;
  }
}
