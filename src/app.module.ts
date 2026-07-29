import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BancoModule } from './banco/banco.module';
import { AutenticacaoModule } from './modulos/autenticacao/autenticacao.module';
import { JogadoresModule } from './modulos/jogadores/jogadores.module';
import { LocaisModule } from './modulos/locais/locais.module';
import { TemporadasModule } from './modulos/temporadas/temporadas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BancoModule,
    AutenticacaoModule,
    JogadoresModule,
    LocaisModule,
    TemporadasModule,
  ],
})
export class AppModule {}
