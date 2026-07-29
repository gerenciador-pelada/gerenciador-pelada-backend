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

## Primeiro administrador

O endpoint publico de cadastro sempre cria ORGANIZADOR. Para promover a primeira conta:

    docker exec -it pelada-postgres psql -U pelada -d gerenciador_pelada \
      -c "UPDATE usuarios SET perfil = 'ADMINISTRADOR' WHERE email = 'seu@email.com';"

A partir dai, esse usuario promove os demais por PATCH /api/usuarios/:id.
