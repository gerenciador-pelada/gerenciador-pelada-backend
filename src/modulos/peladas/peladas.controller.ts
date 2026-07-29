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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UsuarioAtual,
  type UsuarioRequisicao,
} from '../../comum/decoradores/usuario-atual.decorator';
import { ConfiguracoesService } from './configuracoes.service';
import { AlterarStatusDto } from './dto/alterar-status.dto';
import { AtualizarConfiguracaoDto } from './dto/atualizar-configuracao.dto';
import { AtualizarPeladaDto } from './dto/atualizar-pelada.dto';
import { CriarPeladaDto } from './dto/criar-pelada.dto';
import { FiltrarPeladasDto } from './dto/filtrar-peladas.dto';
import { PeladasService } from './peladas.service';

@ApiTags('Peladas')
@ApiBearerAuth()
@Controller('peladas')
export class PeladasController {
  constructor(
    private readonly peladas: PeladasService,
    private readonly configuracoes: ConfiguracoesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma pelada com a configuracao padrao' })
  criar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Body() dto: CriarPeladaDto,
  ) {
    return this.peladas.criar(usuario.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista peladas com filtros e paginacao' })
  listar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Query() filtro: FiltrarPeladasDto,
  ) {
    return this.peladas.listar(usuario.id, filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma pelada pelo id' })
  buscar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.peladas.buscarPorId(usuario.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza nome, data, local ou temporada' })
  atualizar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarPeladaDto,
  ) {
    return this.peladas.atualizar(usuario.id, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Altera o status da pelada' })
  alterarStatus(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AlterarStatusDto,
  ) {
    return this.peladas.alterarStatus(usuario.id, id, dto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove logicamente uma pelada' })
  remover(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.peladas.remover(usuario.id, id);
  }

  @Get(':id/configuracao')
  @ApiOperation({ summary: 'Busca a configuracao da pelada' })
  buscarConfiguracao(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.configuracoes.buscar(usuario.id, id);
  }

  @Patch(':id/configuracao')
  @ApiOperation({ summary: 'Atualiza as regras da pelada' })
  atualizarConfiguracao(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarConfiguracaoDto,
  ) {
    return this.configuracoes.atualizar(usuario.id, id, dto);
  }
}
