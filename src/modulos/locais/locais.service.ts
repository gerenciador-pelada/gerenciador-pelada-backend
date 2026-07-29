import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalPeladaEntity } from '../../banco/entidades/local-pelada.entity';
import { AtualizarLocalDto } from './dto/atualizar-local.dto';
import { CriarLocalDto } from './dto/criar-local.dto';

@Injectable()
export class LocaisService {
  constructor(
    @InjectRepository(LocalPeladaEntity)
    private readonly locais: Repository<LocalPeladaEntity>,
  ) {}

  async criar(
    usuarioId: string,
    dto: CriarLocalDto,
  ): Promise<LocalPeladaEntity> {
    const nome = dto.nome.trim();
    await this.garantirNomeDisponivel(usuarioId, nome);

    return this.locais.save(
      this.locais.create({
        usuarioId,
        nome,
        endereco: dto.endereco?.trim() ?? null,
      }),
    );
  }

  listar(usuarioId: string): Promise<LocalPeladaEntity[]> {
    return this.locais.find({ where: { usuarioId }, order: { nome: 'ASC' } });
  }

  async buscarPorId(usuarioId: string, id: string): Promise<LocalPeladaEntity> {
    const local = await this.locais.findOne({ where: { id, usuarioId } });
    if (!local) {
      throw new NotFoundException('Local nao encontrado');
    }
    return local;
  }

  async atualizar(
    usuarioId: string,
    id: string,
    dto: AtualizarLocalDto,
  ): Promise<LocalPeladaEntity> {
    const local = await this.buscarPorId(usuarioId, id);

    if (dto.nome && dto.nome.trim() !== local.nome) {
      await this.garantirNomeDisponivel(usuarioId, dto.nome.trim());
      local.nome = dto.nome.trim();
    }
    if (dto.endereco !== undefined)
      local.endereco = dto.endereco?.trim() ?? null;

    return this.locais.save(local);
  }

  async remover(usuarioId: string, id: string): Promise<void> {
    await this.locais.softRemove(await this.buscarPorId(usuarioId, id));
  }

  private async garantirNomeDisponivel(
    usuarioId: string,
    nome: string,
  ): Promise<void> {
    const existente = await this.locais.findOne({ where: { usuarioId, nome } });
    if (existente) {
      throw new ConflictException('Ja existe um local com este nome');
    }
  }
}
