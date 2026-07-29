import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracaoPeladaEntity } from '../../banco/entidades/configuracao-pelada.entity';
import { LocalPeladaEntity } from '../../banco/entidades/local-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
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
    ]),
  ],
  controllers: [PeladasController],
  providers: [PeladasService, ConfiguracoesService],
  exports: [PeladasService, ConfiguracoesService],
})
export class PeladasModule {}
