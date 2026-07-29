import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BancoModule } from './banco/banco.module';
import { AutenticacaoModule } from './modulos/autenticacao/autenticacao.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BancoModule,
    AutenticacaoModule,
  ],
})
export class AppModule {}
