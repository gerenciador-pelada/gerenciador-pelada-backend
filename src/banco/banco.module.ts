import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { lerConfiguracaoBanco } from '../configuracao/configuracao';
import { MIGRACOES } from './migracoes';

export function criarOpcoesBanco(): TypeOrmModuleOptions {
  const banco = lerConfiguracaoBanco();
  return {
    type: 'postgres',
    host: banco.host,
    port: banco.porta,
    username: banco.usuario,
    password: banco.senha,
    database: banco.nome,
    autoLoadEntities: true,
    migrations: MIGRACOES,
    migrationsRun: true,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
  };
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: criarOpcoesBanco,
    }),
  ],
})
export class BancoModule {}
