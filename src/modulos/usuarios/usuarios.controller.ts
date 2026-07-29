import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../../comum/decoradores/perfis.decorator';
import {
  UsuarioAtual,
  type UsuarioRequisicao,
} from '../../comum/decoradores/usuario-atual.decorator';
import { PerfilUsuario } from '../../comum/enums/perfil-usuario.enum';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { FiltrarUsuariosDto } from './dto/filtrar-usuarios.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Perfis(PerfilUsuario.ADMINISTRADOR)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuarios com filtros e paginacao' })
  listar(@Query() filtro: FiltrarUsuariosDto) {
    return this.usuarios.listar(filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um usuario pelo id' })
  buscar(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.buscarPorId(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza nome, perfil ou situacao de um usuario' })
  atualizar(
    @UsuarioAtual() administrador: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarUsuarioDto,
  ) {
    return this.usuarios.atualizar(administrador.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove logicamente um usuario' })
  remover(
    @UsuarioAtual() administrador: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usuarios.remover(administrador.id, id);
  }
}
