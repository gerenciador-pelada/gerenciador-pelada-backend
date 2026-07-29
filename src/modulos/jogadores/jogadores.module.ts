import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { JogadoresController } from './jogadores.controller';
import { JogadoresService } from './jogadores.service';

@Module({
  imports: [TypeOrmModule.forFeature([JogadorEntity])],
  controllers: [JogadoresController],
  providers: [JogadoresService],
  exports: [JogadoresService],
})
export class JogadoresModule {}
