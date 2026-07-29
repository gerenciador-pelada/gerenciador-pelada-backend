import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';

@Injectable()
export class PartidasService {
  constructor(
    @InjectRepository(PartidaEntity)
    private partidas: Repository<PartidaEntity>,
  ) {}

  async iniciar(usuarioId: string, id: string) {
    const p = await this.buscar(usuarioId, id);
    if (p.status !== StatusPartida.AGUARDANDO)
      throw new ErroRegraPelada(
        'PARTIDA_NAO_AGUARDANDO',
        'Partida nao pode iniciar',
      );
    p.status = StatusPartida.EM_ANDAMENTO;
    p.iniciadaEm = new Date();
    return this.partidas.save(p);
  }

  async finalizar(usuarioId: string, id: string) {
    const p = await this.buscar(usuarioId, id);
    if (p.status !== StatusPartida.EM_ANDAMENTO)
      throw new ErroRegraPelada(
        'PARTIDA_NAO_EM_ANDAMENTO',
        'Partida nao esta em andamento',
      );
    p.status = StatusPartida.FINALIZADA;
    p.finalizadaEm = new Date();
    return this.partidas.save(p);
  }

  async cancelar(usuarioId: string, id: string) {
    const p = await this.buscar(usuarioId, id);
    if (p.status === StatusPartida.FINALIZADA)
      throw new ErroRegraPelada(
        'PARTIDA_FINALIZADA',
        'Partida finalizada nao pode cancelar',
      );
    p.status = StatusPartida.CANCELADA;
    return this.partidas.save(p);
  }

  /**
   * Carrega a partida ja restrita ao organizador autenticado, numa consulta so.
   *
   * A posse entra como criterio do WHERE, e nao como checagem posterior, para
   * que "partida inexistente" e "partida de outro organizador" respondam o
   * mesmo 404. Separar as duas mensagens revelaria quais ids existem.
   */
  private async buscar(usuarioId: string, id: string) {
    const p = await this.partidas
      .createQueryBuilder('partida')
      .innerJoin(PeladaEntity, 'pelada', 'pelada.id = partida.peladaId')
      .where('partida.id = :id', { id })
      .andWhere('pelada.organizadorId = :usuarioId', { usuarioId })
      .getOne();
    if (!p) throw new NotFoundException('Partida nao encontrada');
    return p;
  }
}
