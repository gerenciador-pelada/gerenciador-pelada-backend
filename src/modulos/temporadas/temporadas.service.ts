import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemporadaEntity } from '../../banco/entidades/temporada.entity';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { AtualizarTemporadaDto } from './dto/atualizar-temporada.dto';
import { CriarTemporadaDto } from './dto/criar-temporada.dto';

@Injectable()
export class TemporadasService {
  constructor(
    @InjectRepository(TemporadaEntity)
    private readonly temporadas: Repository<TemporadaEntity>,
  ) {}

  async criar(
    usuarioId: string,
    dto: CriarTemporadaDto,
  ): Promise<TemporadaEntity> {
    this.validarPeriodo(dto.dataInicio, dto.dataFim);
    const nome = dto.nome.trim();
    await this.garantirNomeDisponivel(usuarioId, nome);

    return this.temporadas.save(
      this.temporadas.create({
        usuarioId,
        nome,
        dataInicio: dto.dataInicio,
        dataFim: dto.dataFim,
        ativa: dto.ativa ?? true,
      }),
    );
  }

  listar(usuarioId: string): Promise<TemporadaEntity[]> {
    return this.temporadas.find({
      where: { usuarioId },
      order: { dataInicio: 'DESC' },
    });
  }

  async buscarPorId(usuarioId: string, id: string): Promise<TemporadaEntity> {
    const temporada = await this.temporadas.findOne({
      where: { id, usuarioId },
    });
    if (!temporada) {
      throw new NotFoundException('Temporada nao encontrada');
    }
    return temporada;
  }

  async atualizar(
    usuarioId: string,
    id: string,
    dto: AtualizarTemporadaDto,
  ): Promise<TemporadaEntity> {
    const temporada = await this.buscarPorId(usuarioId, id);

    const dataInicio = dto.dataInicio ?? temporada.dataInicio;
    const dataFim = dto.dataFim ?? temporada.dataFim;
    this.validarPeriodo(dataInicio, dataFim);

    if (dto.nome && dto.nome.trim() !== temporada.nome) {
      await this.garantirNomeDisponivel(usuarioId, dto.nome.trim());
      temporada.nome = dto.nome.trim();
    }
    temporada.dataInicio = dataInicio;
    temporada.dataFim = dataFim;
    if (dto.ativa !== undefined) temporada.ativa = dto.ativa;

    return this.temporadas.save(temporada);
  }

  async remover(usuarioId: string, id: string): Promise<void> {
    await this.temporadas.softRemove(await this.buscarPorId(usuarioId, id));
  }

  private validarPeriodo(dataInicio: string, dataFim: string): void {
    if (dataFim < dataInicio) {
      throw new ErroRegraPelada(
        'PERIODO_TEMPORADA_INVALIDO',
        'A data de fim deve ser igual ou posterior a data de inicio',
        { dataInicio, dataFim },
      );
    }
  }

  private async garantirNomeDisponivel(
    usuarioId: string,
    nome: string,
  ): Promise<void> {
    const existente = await this.temporadas.findOne({
      where: { usuarioId, nome },
    });
    if (existente) {
      throw new ConflictException('Ja existe uma temporada com este nome');
    }
  }
}
