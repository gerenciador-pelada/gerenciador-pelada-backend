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
import { RankingsService } from './rankings.service';
import { HistoricoService } from './historico.service';
import { RegistrarEventoPartidaDto } from './dto/registrar-evento-partida.dto';
import { FinalizarPartidaDto } from './dto/finalizar-partida.dto';
import { FinalizarPeladaDto } from './dto/finalizar-pelada.dto';
import { DefinirGoleiroDto } from './dto/definir-goleiro.dto';
import { SubstituirJogadorDto } from './dto/substituir-jogador.dto';
import { TrocarJogadoresDto } from './dto/trocar-jogadores.dto';
import { PainelService } from './painel.service';
import { FilaService } from './fila.service';
import {
  AdicionarNaFilaDto,
  EntrarNoLugarDeDto,
  ReordenarFilaDto,
} from './dto/reordenar-fila.dto';

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
    private readonly rankings: RankingsService,
    private readonly historico: HistoricoService,
    private readonly painel: PainelService,
    private readonly filaService: FilaService,
  ) {}

  @Get(':id/painel')
  @ApiOperation({ summary: 'Estado completo da tela principal da pelada' })
  buscarPainel(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.painel.montar(u.id, id);
  }

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

  @Post(':id/finalizar')
  @ApiOperation({ summary: 'Finaliza a pelada e a partida atual atomicamente' })
  finalizarPelada(
    @UsuarioAtual() usuario: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinalizarPeladaDto,
  ) {
    return this.partidas.finalizarPelada(usuario.id, id, dto);
  }

  @Post('/partidas/:partidaId/iniciar') iniciarPartida(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('partidaId', ParseUUIDPipe) id: string,
  ) {
    return this.partidas.iniciar(u.id, id);
  }
  @Post('/partidas/:partidaId/finalizar') finalizarPartida(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('partidaId', ParseUUIDPipe) id: string,
    @Body() dto: FinalizarPartidaDto,
  ) {
    return this.partidas.finalizar(u.id, id, dto);
  }
  @Post('/partidas/:partidaId/cancelar') cancelarPartida(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('partidaId', ParseUUIDPipe) id: string,
  ) {
    return this.partidas.cancelar(u.id, id);
  }
  @Post('/partidas/:partidaId/substituicao')
  @ApiOperation({ summary: 'Troca um jogador em campo por outro da fila' })
  substituir(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('partidaId', ParseUUIDPipe) id: string,
    @Body() dto: SubstituirJogadorDto,
  ) {
    return this.partidas.substituir(u.id, id, dto.saiId, dto.entraId);
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

  @Get('/rankings') listarRankings(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Query('peladaId') peladaId?: string,
  ) {
    return this.rankings.listar(u.id, peladaId);
  }

  @Get(':id/historico') listarHistorico(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.historico.listar(u.id, id);
  }
  @Post(':id/desfazer') desfazer(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.historico.desfazer(u.id, id);
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

  @Post(':id/participantes/:participanteId/pausar')
  @ApiOperation({ summary: 'Saida temporaria, guardando a vaga no time' })
  pausarParticipante(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participanteId', ParseUUIDPipe) participanteId: string,
  ) {
    return this.participantes.pausar(u.id, id, participanteId);
  }

  @Post(':id/participantes/:participanteId/retornar')
  @ApiOperation({ summary: 'Volta de uma pausa e retoma a vaga' })
  retornarParticipante(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participanteId', ParseUUIDPipe) participanteId: string,
  ) {
    return this.participantes.retornar(u.id, id, participanteId);
  }

  @Post(':id/participantes/:participanteId/desistir')
  @ApiOperation({ summary: 'Sai da pelada de vez, liberando a vaga' })
  desistirParticipante(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participanteId', ParseUUIDPipe) participanteId: string,
  ) {
    return this.participantes.desistir(u.id, id, participanteId);
  }

  @Post(':id/trocar-jogadores')
  @ApiOperation({
    summary: 'Troca dois jogadores de time antes da partida comecar',
  })
  trocarJogadores(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TrocarJogadoresDto,
  ) {
    return this.participantes.trocarJogadoresDeTime(
      u.id,
      id,
      dto.participanteA,
      dto.participanteB,
    );
  }

  @Patch(':id/times/:timeId/goleiro')
  @ApiOperation({
    summary: 'Define ou remove o goleiro do time, sem mexer na fila',
  })
  definirGoleiro(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('timeId', ParseUUIDPipe) timeId: string,
    @Body() dto: DefinirGoleiroDto,
  ) {
    return this.participantes.definirGoleiro(
      u.id,
      id,
      timeId,
      dto.participanteId ?? null,
    );
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

  // A fila dos proximos e outra coisa que a ordem de chegada: depois que a
  // pelada comeca, e a `posicao` da fila que decide quem entra.
  @Patch(':id/fila')
  @ApiOperation({ summary: 'Reordena a fila dos proximos' })
  reordenarFila(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReordenarFilaDto,
  ) {
    return this.filaService.reordenar(u.id, id, dto.participanteIds);
  }

  @Post(':id/fila/:participanteId')
  @ApiOperation({ summary: 'Coloca alguem na fila' })
  adicionarNaFila(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participanteId', ParseUUIDPipe) participanteId: string,
    @Body() dto: AdicionarNaFilaDto,
  ) {
    return this.filaService.adicionar(u.id, id, participanteId, dto.posicao);
  }

  @Delete(':id/fila/:participanteId')
  @ApiOperation({ summary: 'Tira alguem da fila' })
  removerDaFila(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participanteId', ParseUUIDPipe) participanteId: string,
  ) {
    return this.filaService.remover(u.id, id, participanteId);
  }

  @Post(':id/fila/:participanteId/entrar')
  @ApiOperation({ summary: 'Poe alguem da fila no lugar de quem esta jogando' })
  entrarNoLugarDe(
    @UsuarioAtual() u: UsuarioRequisicao,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participanteId', ParseUUIDPipe) participanteId: string,
    @Body() dto: EntrarNoLugarDeDto,
  ) {
    return this.filaService.entrarNoLugarDe(
      u.id,
      id,
      participanteId,
      dto.saiId,
    );
  }
}
