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
import { ParticipantesService } from './participantes.service';
import { AdicionarParticipanteDto } from './dto/adicionar-participante.dto';
import { AlterarStatusParticipanteDto } from './dto/alterar-status-participante.dto';
import { ReordenarChegadaDto } from './dto/reordenar-chegada.dto';
import { SorteiosService } from './sorteios.service';
import { PartidasService } from './partidas.service';
import { EventosPartidaService } from './eventos-partida.service';
import { RegistrarEventoPartidaDto } from './dto/registrar-evento-partida.dto';

@ApiTags('Peladas')
@ApiBearerAuth()
@Controller('peladas')
export class PeladasController {
  constructor(
    private readonly peladas: PeladasService,
    private readonly configuracoes: ConfiguracoesService,
    private readonly participantes: ParticipantesService,
    private readonly sorteios: SorteiosService,
    private readonly partidas: PartidasService,
    private readonly eventos: EventosPartidaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma pelada com a configuracao padrao' })
  criar(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Body() dto: CriarPeladaDto,
  ) {
    return this.peladas.criar(usuario.id, dto);
  }

  @Post(':id/sorteio')
  sortear(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sorteios.sortear(u.id, id);
  }

  @Post('/partidas/:partidaId/iniciar') iniciarPartida(
    @Param('partidaId', ParseUUIDPipe) id: string,
  ) {
    return this.partidas.iniciar(id);
  }
  @Post('/partidas/:partidaId/finalizar') finalizarPartida(
    @Param('partidaId', ParseUUIDPipe) id: string,
  ) {
    return this.partidas.finalizar(id);
  }
  @Post('/partidas/:partidaId/cancelar') cancelarPartida(
    @Param('partidaId', ParseUUIDPipe) id: string,
  ) {
    return this.partidas.cancelar(id);
  }
  @Post('/partidas/:partidaId/eventos') registrarEvento(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('partidaId', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarEventoPartidaDto,
  ) {
    return this.eventos.registrar(u.id, id, dto);
  }

  @Post(':id/participantes') adicionarParticipante(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdicionarParticipanteDto,
  ) {
    return this.participantes.adicionar(u.id, id, dto);
  }
  @Get(':id/participantes') listarParticipantes(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.participantes.listar(u.id, id);
  }
  @Post(':id/participantes/:participanteId/chegada') marcarChegada(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participanteId', ParseUUIDPipe) participanteId: string,
  ) {
    return this.participantes.marcarChegada(u.id, id, participanteId);
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

  @Patch(':id/participantes/:participanteId/status')
  alterarStatusParticipante(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participanteId', ParseUUIDPipe) participanteId: string,
    @Body() dto: AlterarStatusParticipanteDto,
  ) {
    return this.participantes.alterarStatus(
      u.id,
      id,
      participanteId,
      dto.status,
    );
  }

  @Delete(':id/participantes/:participanteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removerParticipante(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participanteId', ParseUUIDPipe) participanteId: string,
  ) {
    return this.participantes.remover(u.id, id, participanteId);
  }

  @Patch(':id/ordem-chegada')
  reordenarChegada(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReordenarChegadaDto,
  ) {
    return this.participantes.reordenar(u.id, id, dto.participanteIds);
  }
}
