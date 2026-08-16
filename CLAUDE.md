# gerenciador-pelada-backend

API do gerenciador de peladas. Spec do sistema em
`../docs/superpowers/specs/2026-07-28-gerenciador-pelada-design.md`.

## Arquitetura

Três camadas, com uma regra inegociável: **`src/dominio/` não importa nada**.
Nem NestJS, nem TypeORM, nem outro módulo. É TypeScript puro e testável sem banco.

- `src/modulos/`  — controllers, DTOs, validação, orquestração, transações
- `src/dominio/`  — todas as regras da pelada
- `src/banco/`    — entidades TypeORM e migrações
- `src/comum/`    — infraestrutura transversal (filtro, interceptador, decoradores)

Serviços que alteram o estado da pelada seguem sempre o ciclo:
carregar do banco → montar objeto de domínio → chamar o domínio → persistir em transação.

Nenhum valor de regra (pontuação, tamanho de time, critério de desempate) pode ser
escrito em código. Tudo vem de `ConfiguracaoPeladaEntity`.

## Nomenclatura

- Termos de domínio em português; sufixos do NestJS em inglês (`Entity`, `Service`,
  `Controller`, `Module`, `Dto`, `Guard`, `Strategy`).
- Classes de `src/dominio/` são 100% português, sem sufixo inglês.
- Arquivos em kebab-case, pastas em português.
- Colunas do banco em snake_case via `SnakeNamingStrategy` — não declare `name` na coluna.

## Comandos

- `npm run start:dev`       — sobe a API em modo watch
- `npm test`                — testes unitários
- `npm run test:e2e`        — testes end-to-end
- `npm run banco:subir`     — sobe o PostgreSQL no Docker
- `npm run migracao:gerar -- src/banco/migracoes/NomeDaMigracao`
- `npm run migracao:rodar`  — aplica migrações pendentes
- `npm run contas:expurgar` — apaga de vez as contas excluídas há mais de 30 dias
  (`-- --simular` só lista)

## Exclusão de conta

A App Store recusa app que cria conta e não deixa apagá-la pelo próprio app
(diretriz 5.1.1(v)). `DELETE /api/autenticacao/conta` é essa saída, e ela apaga
de verdade — desativar não cumpre a diretriz.

O modelo é bloqueio imediato mais expurgo em 30 dias:

- **na hora** — nome, e-mail e senha saem do banco, `ativo` vira falso e a linha
  é removida logicamente. Login e token caem no mesmo instante, porque os dois
  passam por `findOne`, que ignora removido logicamente. O e-mail vira endereço
  inválido e único em vez de sumir: o índice de e-mail é único e **não** é
  parcial, então guardar o endereço real impediria a pessoa de se cadastrar
  outra vez;
- **em 30 dias** — `npm run contas:expurgar` apaga peladas, partidas, jogadores
  e rankings. A ordem dos passos está em `src/modulos/usuarios/expurgo-contas.ts`
  e não é estética: o banco protege com `RESTRICT` o autor de cada gol, o
  participante de cada pelada e o local de cada pelada. Cinco tabelas guardam
  `pelada_id` sem chave estrangeira e por isso precisam estar na lista à mão.

O prazo de 30 dias está escrito na política de privacidade do site e na tela de
confirmação dos dois clientes. Mudar `DIAS_ATE_EXPURGO` sem mudar os três deixa
a promessa mentirosa.

**O expurgo ainda não está agendado.** Ele roda quando alguém chama o comando.

## Segurança

Quatro coisas falham fechado — se você mexer nelas, mexa com intenção:

- **`JWT_SEGREDO`** — a API se recusa a subir com segredo de exemplo ou com
  menos de 32 caracteres. Segredo conhecido = token de organizador forjável.
  Exceção: `NODE_ENV=test`, que nunca atende a rede.
- **`CORS_ORIGENS`** — lista fechada, separada por vírgula. Vazio significa
  nenhuma origem externa, não todas. Nunca volte para `origin: true`.
- **`CADASTRO_CONVITE`** — o cadastro cria ORGANIZADOR, então exige este
  código. Vazio = cadastro fechado. Comparação em tempo constante.
- **Rate limit** — 120 req/min global, 5/min em `entrar` e `cadastrar`.

Gerar segredo e convite:

    node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
    node -e "console.log(require('crypto').randomBytes(6).toString('base64url'))"

## Primeiro administrador

O endpoint de cadastro sempre cria ORGANIZADOR. Para promover a primeira conta:

    docker exec -it pelada-postgres psql -U pelada -d gerenciador_pelada \
      -c "UPDATE usuarios SET perfil = 'ADMINISTRADOR' WHERE email = 'seu@email.com';"

A partir dai, esse usuario promove os demais por PATCH /api/usuarios/:id.
