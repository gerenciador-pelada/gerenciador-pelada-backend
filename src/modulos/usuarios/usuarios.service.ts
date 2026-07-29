import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioEntity } from '../../banco/entidades/usuario.entity';
import { ResultadoPaginado } from '../../comum/dto/resultado-paginado';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { FiltrarUsuariosDto } from './dto/filtrar-usuarios.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuarios: Repository<UsuarioEntity>,
  ) {}

  async listar(
    filtro: FiltrarUsuariosDto,
  ): Promise<ResultadoPaginado<UsuarioEntity>> {
    const construtor = this.usuarios.createQueryBuilder('usuario');

    if (filtro.busca) {
      construtor.andWhere(
        '(usuario.nome ILIKE :busca OR usuario.email ILIKE :busca)',
        {
          busca: `%${filtro.busca.trim().toLowerCase()}%`,
        },
      );
    }
    if (filtro.perfil) {
      construtor.andWhere('usuario.perfil = :perfil', {
        perfil: filtro.perfil,
      });
    }

    const [itens, total] = await construtor
      .orderBy('usuario.nome', 'ASC')
      .skip(filtro.pular)
      .take(filtro.limite)
      .getManyAndCount();

    return ResultadoPaginado.criar(itens, total, filtro.pagina, filtro.limite);
  }

  async buscarPorId(id: string): Promise<UsuarioEntity> {
    const usuario = await this.usuarios.findOne({ where: { id } });
    if (!usuario) {
      throw new NotFoundException('Usuario nao encontrado');
    }
    return usuario;
  }

  async atualizar(
    idAdministrador: string,
    id: string,
    dto: AtualizarUsuarioDto,
  ): Promise<UsuarioEntity> {
    const usuario = await this.buscarPorId(id);

    const alterandoASiMesmo = usuario.id === idAdministrador;
    if (alterandoASiMesmo && dto.perfil && dto.perfil !== usuario.perfil) {
      throw new ErroRegraPelada(
        'ADMINISTRADOR_NAO_PODE_ALTERAR_PROPRIO_PERFIL',
        'Um administrador nao pode alterar o proprio perfil',
      );
    }
    if (alterandoASiMesmo && dto.ativo === false) {
      throw new ErroRegraPelada(
        'ADMINISTRADOR_NAO_PODE_DESATIVAR_PROPRIA_CONTA',
        'Um administrador nao pode desativar a propria conta',
      );
    }

    if (dto.nome !== undefined) usuario.nome = dto.nome.trim();
    if (dto.perfil !== undefined) usuario.perfil = dto.perfil;
    if (dto.ativo !== undefined) usuario.ativo = dto.ativo;

    return this.usuarios.save(usuario);
  }

  async remover(idAdministrador: string, id: string): Promise<void> {
    const usuario = await this.buscarPorId(id);

    if (usuario.id === idAdministrador) {
      throw new ErroRegraPelada(
        'ADMINISTRADOR_NAO_PODE_REMOVER_PROPRIA_CONTA',
        'Um administrador nao pode remover a propria conta',
      );
    }

    await this.usuarios.softRemove(usuario);
  }
}
