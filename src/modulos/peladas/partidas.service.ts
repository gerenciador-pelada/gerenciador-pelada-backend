import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
@Injectable()
export class PartidasService {
  constructor(
    @InjectRepository(PartidaEntity)
    private partidas: Repository<PartidaEntity>,
  ) {}
  async iniciar(id: string) {
    const p = await this.buscar(id);
    if (p.status !== StatusPartida.AGUARDANDO)
      throw new ErroRegraPelada(
        'PARTIDA_NAO_AGUARDANDO',
        'Partida nao pode iniciar',
      );
    p.status = StatusPartida.EM_ANDAMENTO;
    p.iniciadaEm = new Date();
    return this.partidas.save(p);
  }
  async finalizar(id: string) {
    const p = await this.buscar(id);
    if (p.status !== StatusPartida.EM_ANDAMENTO)
      throw new ErroRegraPelada(
        'PARTIDA_NAO_EM_ANDAMENTO',
        'Partida nao esta em andamento',
      );
    p.status = StatusPartida.FINALIZADA;
    p.finalizadaEm = new Date();
    return this.partidas.save(p);
  }
  async cancelar(id: string) {
    const p = await this.buscar(id);
    if (p.status === StatusPartida.FINALIZADA)
      throw new ErroRegraPelada(
        'PARTIDA_FINALIZADA',
        'Partida finalizada nao pode cancelar',
      );
    p.status = StatusPartida.CANCELADA;
    return this.partidas.save(p);
  }
  private async buscar(id: string) {
    const p = await this.partidas.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Partida nao encontrada');
    return p;
  }
}
