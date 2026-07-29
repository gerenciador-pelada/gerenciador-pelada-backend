import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';

/**
 * Verificacao de posse da pelada, compartilhada pelos servicos que operam sobre
 * recursos filhos (partidas, historico, rankings).
 *
 * Devolve 404, e nao 403, quando a pelada e de outro organizador: responder 403
 * confirmaria que aquele id existe. Mesmo criterio ja usado por jogadores,
 * locais, temporadas e participantes.
 */
@Injectable()
export class AcessoPeladaService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
  ) {}

  async garantirPelada(usuarioId: string, peladaId: string): Promise<void> {
    const total = await this.peladas.count({
      where: { id: peladaId, organizadorId: usuarioId },
    });
    if (total === 0) {
      throw new NotFoundException('Pelada nao encontrada');
    }
  }
}
