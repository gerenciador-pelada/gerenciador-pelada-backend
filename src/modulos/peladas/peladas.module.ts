import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracaoPeladaEntity } from '../../banco/entidades/configuracao-pelada.entity';
import { LocalPeladaEntity } from '../../banco/entidades/local-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { ParticipantesService } from './participantes.service';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { SorteiosService } from './sorteios.service';
import { TemporadaEntity } from '../../banco/entidades/temporada.entity';
import { ConfiguracoesService } from './configuracoes.service';
import { PeladasController } from './peladas.controller';
import { PeladasService } from './peladas.service';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { PartidasService } from './partidas.service';
import { EventosPartidaService } from './eventos-partida.service';
import { PontuacaoJogadorEntity } from '../../banco/entidades/pontuacao-jogador.entity';
import { RankingsService } from './rankings.service';
import { HistoricoAcaoEntity } from '../../banco/entidades/historico-acao.entity';
import { HistoricoService } from './historico.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PeladaEntity,
      ConfiguracaoPeladaEntity,
      LocalPeladaEntity,
      TemporadaEntity,
      JogadorEntity,
      ParticipantePeladaEntity,
      FilaJogadorEntity,
      PartidaEntity,
      ParticipacaoPartidaEntity,
      EventoPartidaEntity,
      PontuacaoJogadorEntity,
      HistoricoAcaoEntity,
    ]),
  ],
  controllers: [PeladasController],
  providers: [
    PeladasService,
    ConfiguracoesService,
    ParticipantesService,
    SorteiosService,
    PartidasService,
    EventosPartidaService,
    RankingsService,
    HistoricoService,
  ],
  exports: [PeladasService, ConfiguracoesService],
})
export class PeladasModule {}
