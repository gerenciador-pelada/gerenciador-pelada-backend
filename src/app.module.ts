import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BancoModule } from './banco/banco.module';
import { AutenticacaoModule } from './modulos/autenticacao/autenticacao.module';
import { JogadoresModule } from './modulos/jogadores/jogadores.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BancoModule,
    AutenticacaoModule,
    JogadoresModule,
  ],
})
export class AppModule {}
