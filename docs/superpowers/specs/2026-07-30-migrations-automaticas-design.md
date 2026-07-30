# Migrations automáticas na inicialização

## Objetivo

Executar todas as migrations pendentes sempre que o backend iniciar, antes de
aceitar requisições, em desenvolvimento e produção.

## Abordagens avaliadas

1. Encadear `migration:run` nos scripts `start`: simples, mas cada novo comando
   de inicialização poderia esquecer essa etapa e o data source da CLI usa
   caminhos diferentes entre TypeScript e o build.
2. Chamar `DataSource.runMigrations()` no `main.ts`: explícito, porém ocorre
   depois de o Nest criar a aplicação e duplica uma responsabilidade nativa da
   configuração TypeORM.
3. Ativar `migrationsRun` no `BancoModule`: abordagem escolhida. A conexão
   executa as migrations antes de ficar disponível para a aplicação e todos os
   scripts de inicialização passam pelo mesmo fluxo.

## Desenho

O `BancoModule` continuará sendo o único responsável por configurar a conexão.
Sua factory fornecerá `migrationsRun: true`, manterá `synchronize: false` e
continuará carregando migrations com um caminho compatível com `src` e `dist`.

Fluxo:

1. O Nest cria o `AppModule`.
2. O TypeORM abre a conexão PostgreSQL.
3. O TypeORM consulta a tabela de migrations e aplica somente as pendentes.
4. Com sucesso, a inicialização continua até `app.listen`.
5. Se conexão ou migration falhar, o bootstrap falha e a API não aceita
   tráfego com um schema parcialmente atualizado.

As migrations permanecem idempotentes pelo controle nativo do TypeORM; iniciar
mais de uma vez não reaplica migrations já registradas.

## Validação

- Teste da factory de conexão protege `migrationsRun: true` e
  `synchronize: false`.
- A suíte completa, lint e build validam a integração.
- O comando de migrations contra o PostgreSQL local confirma que não há
  migrations pendentes depois da inicialização/configuração.
