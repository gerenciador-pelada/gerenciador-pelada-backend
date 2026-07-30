import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { FiltroExcecoesGlobal } from '../../src/comum/filtros/filtro-excecoes-global';
import { InterceptadorResposta } from '../../src/comum/interceptadores/interceptador-resposta';

export interface AplicacaoTeste {
  app: INestApplication;
  fonteDados: DataSource;
  limpar: () => Promise<void>;
  encerrar: () => Promise<void>;
}

const TABELAS = ['temporadas', 'locais_pelada', 'jogadores', 'usuarios'];

export async function criarAplicacaoTeste(): Promise<AplicacaoTeste> {
  const modulo = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = modulo.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new FiltroExcecoesGlobal());
  app.useGlobalInterceptors(new InterceptadorResposta());
  await app.init();

  const fonteDados = app.get(DataSource);
  await fonteDados.runMigrations();

  const limpar = async () => {
    await fonteDados.query(`TRUNCATE TABLE ${TABELAS.join(', ')} CASCADE`);
  };

  return {
    app,
    fonteDados,
    limpar,
    encerrar: async () => {
      await app.close();
    },
  };
}
