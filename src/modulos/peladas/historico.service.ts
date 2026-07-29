import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { HistoricoAcaoEntity } from '../../banco/entidades/historico-acao.entity';
@Injectable()
export class HistoricoService {
  constructor(
    @InjectRepository(HistoricoAcaoEntity)
    private readonly historico: Repository<HistoricoAcaoEntity>,
  ) {}
  listar(peladaId: string) {
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
  async desfazer(peladaId: string) {
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
