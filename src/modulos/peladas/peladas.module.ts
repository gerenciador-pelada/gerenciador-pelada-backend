import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracaoPeladaEntity } from '../../banco/entidades/configuracao-pelada.entity';
import { LocalPeladaEntity } from '../../banco/entidades/local-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { ParticipantesService } from './participantes.service';
import { TemporadaEntity } from '../../banco/entidades/temporada.entity';
import { ConfiguracoesService } from './configuracoes.service';
import { PeladasController } from './peladas.controller';
import { PeladasService } from './peladas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PeladaEntity,
      ConfiguracaoPeladaEntity,
      LocalPeladaEntity,
      TemporadaEntity,
      JogadorEntity,
      ParticipantePeladaEntity,
    ]),
  ],
  controllers: [PeladasController],
  providers: [PeladasService, ConfiguracoesService, ParticipantesService],
  exports: [PeladasService, ConfiguracoesService],
})
export class PeladasModule {}
