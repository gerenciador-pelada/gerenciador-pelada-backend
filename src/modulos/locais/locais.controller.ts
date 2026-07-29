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
import { AtualizarLocalDto } from './dto/atualizar-local.dto';
import { CriarLocalDto } from './dto/criar-local.dto';
import { LocaisService } from './locais.service';

@ApiTags('Locais')
@ApiBearerAuth()
@Controller('locais')
export class LocaisController {
  constructor(private readonly locais: LocaisService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um local de pelada' })
  criar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Body() dto: CriarLocalDto,
  ) {
    return this.locais.criar(usuario.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os locais do organizador' })
  listar(@UsuarioAtual() usuario: UsuarioRequisicao) {
    return this.locais.listar(usuario.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um local pelo id' })
  buscar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.locais.buscarPorId(usuario.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um local' })
  atualizar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarLocalDto,
  ) {
    return this.locais.atualizar(usuario.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove logicamente um local' })
  remover(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.locais.remover(usuario.id, id);
  }
}
