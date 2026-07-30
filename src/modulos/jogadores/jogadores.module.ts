import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { PontuacaoJogadorEntity } from '../../banco/entidades/pontuacao-jogador.entity';
import { JogadoresController } from './jogadores.controller';
import { JogadoresService } from './jogadores.service';
import { PerfilJogadorService } from './perfil-jogador.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JogadorEntity,
      PontuacaoJogadorEntity,
      EventoPartidaEntity,
    ]),
  ],
  controllers: [JogadoresController],
  providers: [JogadoresService, PerfilJogadorService],
  exports: [JogadoresService],
})
export class JogadoresModule {}
