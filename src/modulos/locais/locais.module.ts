import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocalPeladaEntity } from '../../banco/entidades/local-pelada.entity';
import { LocaisController } from './locais.controller';
import { LocaisService } from './locais.service';

@Module({
  imports: [TypeOrmModule.forFeature([LocalPeladaEntity])],
  controllers: [LocaisController],
  providers: [LocaisService],
  exports: [LocaisService],
})
export class LocaisModule {}
