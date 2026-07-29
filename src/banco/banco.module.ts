import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { lerConfiguracaoBanco } from '../configuracao/configuracao';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const banco = lerConfiguracaoBanco();
        return {
          type: 'postgres' as const,
          host: banco.host,
          port: banco.porta,
          username: banco.usuario,
          password: banco.senha,
          database: banco.nome,
          autoLoadEntities: true,
          migrations: [join(__dirname, 'migracoes', '*{.ts,.js}')],
          migrationsRun: false,
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: false,
        };
      },
    }),
  ],
})
export class BancoModule {}
