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
import { AtualizarJogadorDto } from './dto/atualizar-jogador.dto';
import { CriarJogadorDto } from './dto/criar-jogador.dto';
import { FiltrarJogadoresDto } from './dto/filtrar-jogadores.dto';
import { JogadoresService } from './jogadores.service';

@ApiTags('Jogadores')
@ApiBearerAuth()
@Controller('jogadores')
export class JogadoresController {
  constructor(private readonly jogadores: JogadoresService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um jogador' })
  criar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Body() dto: CriarJogadorDto,
  ) {
    return this.jogadores.criar(usuario.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista jogadores com filtros e paginacao' })
  listar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Query() filtro: FiltrarJogadoresDto,
  ) {
    return this.jogadores.listar(usuario.id, filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um jogador pelo id' })
  buscar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jogadores.buscarPorId(usuario.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um jogador' })
  atualizar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarJogadorDto,
  ) {
    return this.jogadores.atualizar(usuario.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove logicamente um jogador' })
  remover(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jogadores.remover(usuario.id, id);
  }
}
