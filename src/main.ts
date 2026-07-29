import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { FiltroExcecoesGlobal } from './comum/filtros/filtro-excecoes-global';
import { InterceptadorResposta } from './comum/interceptadores/interceptador-resposta';
import { lerConfiguracaoApp } from './configuracao/configuracao';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = lerConfiguracaoApp();

  app.setGlobalPrefix(config.prefixo);
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new FiltroExcecoesGlobal());
  app.useGlobalInterceptors(new InterceptadorResposta());

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Gerenciador de Pelada')
      .setDescription('API de organizacao de peladas de futebol')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(`${config.prefixo}/docs`, app, documento);

  await app.listen(config.porta);
}

void iniciar();
