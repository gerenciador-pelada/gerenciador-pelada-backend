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
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UsuarioAtual,
  type UsuarioRequisicao,
} from '../../comum/decoradores/usuario-atual.decorator';
import { AtualizarGrupoPeladaDto } from './dto/atualizar-grupo-pelada.dto';
import { CriarGrupoPeladaDto } from './dto/criar-grupo-pelada.dto';
import { GruposPeladaService } from './grupos-pelada.service';

@ApiTags('Grupos de pelada')
@ApiBearerAuth()
@Controller('grupos-pelada')
export class GruposPeladaController {
  constructor(private readonly grupos: GruposPeladaService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma pelada recorrente' })
  criar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Body() dto: CriarGrupoPeladaDto,
  ) {
    return this.grupos.criar(usuario.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista as peladas recorrentes do organizador' })
  listar(@UsuarioAtual() usuario: UsuarioRequisicao) {
    return this.grupos.listar(usuario.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma pelada recorrente com suas edicoes' })
  buscar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.grupos.buscarResumo(usuario.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renomeia uma pelada recorrente' })
  atualizar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarGrupoPeladaDto,
  ) {
    return this.grupos.atualizar(usuario.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma pelada recorrente sem edicoes' })
  remover(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.grupos.remover(usuario.id, id);
  }
}
