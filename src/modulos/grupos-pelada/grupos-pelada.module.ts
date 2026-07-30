import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrupoPeladaEntity } from '../../banco/entidades/grupo-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { GruposPeladaController } from './grupos-pelada.controller';
import { GruposPeladaService } from './grupos-pelada.service';

@Module({
  imports: [TypeOrmModule.forFeature([GrupoPeladaEntity, PeladaEntity])],
  controllers: [GruposPeladaController],
  providers: [GruposPeladaService],
  exports: [GruposPeladaService],
})
export class GruposPeladaModule {}
