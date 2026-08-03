import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { BancoModule } from './banco/banco.module';
import { ThrottlerAtrasDeProxy } from './comum/guards/throttler-atras-de-proxy.guard';
import { AssinaturasModule } from './modulos/assinaturas/assinaturas.module';
import { AutenticacaoModule } from './modulos/autenticacao/autenticacao.module';
import { GruposPeladaModule } from './modulos/grupos-pelada/grupos-pelada.module';
import { JogadoresModule } from './modulos/jogadores/jogadores.module';
import { LocaisModule } from './modulos/locais/locais.module';
import { PeladasModule } from './modulos/peladas/peladas.module';
import { TemporadasModule } from './modulos/temporadas/temporadas.module';
import { UsuariosModule } from './modulos/usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Teto global por IP. Sozinho nao impede um ataque distribuido, mas tira
    // da mesa a forca bruta de senha, que e o risco real de um login exposto.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BancoModule,
    AssinaturasModule,
    AutenticacaoModule,
    GruposPeladaModule,
    JogadoresModule,
    LocaisModule,
    PeladasModule,
    TemporadasModule,
    UsuariosModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerAtrasDeProxy }],
})
export class AppModule {}
