import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { FiltroExcecoesGlobal } from './comum/filtros/filtro-excecoes-global';
import { InterceptadorResposta } from './comum/interceptadores/interceptador-resposta';
import {
  lerConfiguracaoApp,
  lerOrigensPermitidas,
} from './configuracao/configuracao';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = lerConfiguracaoApp();

  app.setGlobalPrefix(config.prefixo);

  // Lista fechada, nao `origin: true`. Refletir a origem de quem pergunta
  // autoriza qualquer site a chamar a API com o cookie/token do usuario.
  const origens = lerOrigensPermitidas();
  app.enableCors({
    origin: origens.length > 0 ? origens : false,
    credentials: true,
  });

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
      .setTitle('Varzeô')
      .setDescription('API de organizacao de peladas de futebol')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(`${config.prefixo}/docs`, app, documento);

  await app.listen(config.porta);
}

void iniciar();
