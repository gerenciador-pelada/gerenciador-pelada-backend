import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { lerConfiguracaoBanco } from '../configuracao/configuracao';

const banco = lerConfiguracaoBanco();

export const fonteDados = new DataSource({
  type: 'postgres',
  host: banco.host,
  port: banco.porta,
  username: banco.usuario,
  password: banco.senha,
  database: banco.nome,
  entities: ['src/banco/entidades/*.entity.ts'],
  migrations: ['src/banco/migracoes/*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
});

export default fonteDados;
