import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemporadaEntity } from '../../banco/entidades/temporada.entity';
import { TemporadasController } from './temporadas.controller';
import { TemporadasService } from './temporadas.service';

@Module({
  imports: [TypeOrmModule.forFeature([TemporadaEntity])],
  controllers: [TemporadasController],
  providers: [TemporadasService],
  exports: [TemporadasService],
})
export class TemporadasModule {}
