import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracaoPeladaEntity } from '../../banco/entidades/configuracao-pelada.entity';
import { LocalPeladaEntity } from '../../banco/entidades/local-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { TemporadaEntity } from '../../banco/entidades/temporada.entity';
import { ResultadoPaginado } from '../../comum/dto/resultado-paginado';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { MaquinaStatusPelada } from '../../dominio/pelada/maquina-status-pelada';
import { AtualizarPeladaDto } from './dto/atualizar-pelada.dto';
import { CriarPeladaDto } from './dto/criar-pelada.dto';
import { FiltrarPeladasDto } from './dto/filtrar-peladas.dto';

@Injectable()
export class PeladasService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    @InjectRepository(LocalPeladaEntity)
    private readonly locais: Repository<LocalPeladaEntity>,
    @InjectRepository(TemporadaEntity)
    private readonly temporadas: Repository<TemporadaEntity>,
  ) {}

  async criar(usuarioId: string, dto: CriarPeladaDto): Promise<PeladaEntity> {
    await this.garantirLocalDoOrganizador(usuarioId, dto.localId);
    if (dto.temporadaId) {
      await this.garantirTemporadaDoOrganizador(usuarioId, dto.temporadaId);
    }

    const pelada = this.peladas.create({
      organizadorId: usuarioId,
      localId: dto.localId,
      temporadaId: dto.temporadaId ?? null,
      nome: dto.nome.trim(),
      dataHora: new Date(dto.dataHora),
      status: StatusPelada.ABERTA_INSCRICOES,
      configuracao: new ConfiguracaoPeladaEntity(),
    });

    return this.peladas.save(pelada);
  }

  async listar(
    usuarioId: string,
    filtro: FiltrarPeladasDto,
  ): Promise<ResultadoPaginado<PeladaEntity>> {
    const construtor = this.peladas
      .createQueryBuilder('pelada')
      .leftJoinAndSelect('pelada.local', 'local')
      .leftJoinAndSelect('pelada.configuracao', 'configuracao')
      .where('pelada.organizadorId = :organizadorId', {
        organizadorId: usuarioId,
      });

    if (filtro.busca) {
      construtor.andWhere('pelada.nome ILIKE :busca', {
        busca: `%${filtro.busca.trim().toLowerCase()}%`,
      });
    }
    if (filtro.status) {
      construtor.andWhere('pelada.status = :status', { status: filtro.status });
    }
    if (filtro.localId) {
      construtor.andWhere('pelada.localId = :localId', {
        localId: filtro.localId,
      });
    }
    if (filtro.temporadaId) {
      construtor.andWhere('pelada.temporadaId = :temporadaId', {
        temporadaId: filtro.temporadaId,
      });
    }
    if (filtro.dataInicio) {
      construtor.andWhere('pelada.dataHora >= :dataInicio', {
        dataInicio: `${filtro.dataInicio}T00:00:00`,
      });
    }
    if (filtro.dataFim) {
      construtor.andWhere('pelada.dataHora <= :dataFim', {
        dataFim: `${filtro.dataFim}T23:59:59`,
      });
    }

    const [itens, total] = await construtor
      .orderBy('pelada.dataHora', 'DESC')
      .skip(filtro.pular)
      .take(filtro.limite)
      .getManyAndCount();

    return ResultadoPaginado.criar(itens, total, filtro.pagina, filtro.limite);
  }

  async buscarPorId(usuarioId: string, id: string): Promise<PeladaEntity> {
    const pelada = await this.peladas.findOne({
      where: { id, organizadorId: usuarioId },
      relations: ['configuracao', 'local', 'temporada'],
    });
    if (!pelada) {
      throw new NotFoundException('Pelada nao encontrada');
    }
    return pelada;
  }

  async atualizar(
    usuarioId: string,
    id: string,
    dto: AtualizarPeladaDto,
  ): Promise<PeladaEntity> {
    const pelada = await this.buscarPorId(usuarioId, id);

    if (dto.localId && dto.localId !== pelada.localId) {
      await this.garantirLocalDoOrganizador(usuarioId, dto.localId);
      pelada.localId = dto.localId;
    }
    if (dto.temporadaId !== undefined) {
      if (dto.temporadaId) {
        await this.garantirTemporadaDoOrganizador(usuarioId, dto.temporadaId);
      }
      pelada.temporadaId = dto.temporadaId ?? null;
    }
    if (dto.nome !== undefined) {
      pelada.nome = dto.nome.trim();
    }
    if (dto.dataHora !== undefined) {
      pelada.dataHora = new Date(dto.dataHora);
    }

    return this.peladas.save(pelada);
  }

  async alterarStatus(
    usuarioId: string,
    id: string,
    status: StatusPelada,
  ): Promise<PeladaEntity> {
    const pelada = await this.buscarPorId(usuarioId, id);
    MaquinaStatusPelada.garantirTransicao(pelada.status, status);
    pelada.status = status;
    return this.peladas.save(pelada);
  }

  async remover(usuarioId: string, id: string): Promise<void> {
    await this.peladas.softRemove(await this.buscarPorId(usuarioId, id));
  }

  private async garantirLocalDoOrganizador(
    usuarioId: string,
    localId: string,
  ): Promise<void> {
    const local = await this.locais.findOne({
      where: { id: localId, usuarioId },
    });
    if (!local) {
      throw new NotFoundException('Local nao encontrado');
    }
  }

  private async garantirTemporadaDoOrganizador(
    usuarioId: string,
    temporadaId: string,
  ): Promise<void> {
    const temporada = await this.temporadas.findOne({
      where: { id: temporadaId, usuarioId },
    });
    if (!temporada) {
      throw new NotFoundException('Temporada nao encontrada');
    }
  }
}
