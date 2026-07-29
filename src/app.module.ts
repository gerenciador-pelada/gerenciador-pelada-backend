import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BancoModule } from './banco/banco.module';
import { AutenticacaoModule } from './modulos/autenticacao/autenticacao.module';
import { JogadoresModule } from './modulos/jogadores/jogadores.module';
import { LocaisModule } from './modulos/locais/locais.module';
import { PeladasModule } from './modulos/peladas/peladas.module';
import { TemporadasModule } from './modulos/temporadas/temporadas.module';
import { UsuariosModule } from './modulos/usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BancoModule,
    AutenticacaoModule,
    JogadoresModule,
    LocaisModule,
    PeladasModule,
    TemporadasModule,
    UsuariosModule,
  ],
})
export class AppModule {}
