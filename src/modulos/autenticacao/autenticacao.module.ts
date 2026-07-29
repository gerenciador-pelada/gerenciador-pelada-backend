import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioEntity } from '../../banco/entidades/usuario.entity';
import { lerConfiguracaoJwt } from '../../configuracao/configuracao';
import { AutenticacaoController } from './autenticacao.controller';
import { AutenticacaoService } from './autenticacao.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PerfisGuard } from './guards/perfis.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsuarioEntity]),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const jwt = lerConfiguracaoJwt();
        return {
          secret: jwt.segredo,
          signOptions: {
            expiresIn: jwt.expiracao as JwtSignOptions['expiresIn'],
          },
        };
      },
    }),
  ],
  controllers: [AutenticacaoController],
  providers: [
    AutenticacaoService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PerfisGuard },
  ],
  exports: [AutenticacaoService],
})
export class AutenticacaoModule {}
