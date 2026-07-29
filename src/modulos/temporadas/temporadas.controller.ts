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
import { AtualizarTemporadaDto } from './dto/atualizar-temporada.dto';
import { CriarTemporadaDto } from './dto/criar-temporada.dto';
import { TemporadasService } from './temporadas.service';

@ApiTags('Temporadas')
@ApiBearerAuth()
@Controller('temporadas')
export class TemporadasController {
  constructor(private readonly temporadas: TemporadasService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma temporada' })
  criar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Body() dto: CriarTemporadaDto,
  ) {
    return this.temporadas.criar(usuario.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista as temporadas do organizador' })
  listar(@UsuarioAtual() usuario: UsuarioRequisicao) {
    return this.temporadas.listar(usuario.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma temporada pelo id' })
  buscar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.temporadas.buscarPorId(usuario.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma temporada' })
  atualizar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarTemporadaDto,
  ) {
    return this.temporadas.atualizar(usuario.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove logicamente uma temporada' })
  remover(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.temporadas.remover(usuario.id, id);
  }
}
