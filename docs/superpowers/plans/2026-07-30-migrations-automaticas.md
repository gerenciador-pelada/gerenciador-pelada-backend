# Migrations Automáticas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar migrations pendentes automaticamente antes de o backend aceitar requisições.

**Architecture:** A configuração central do `BancoModule` será exposta por uma factory pequena e testável. A conexão TypeORM receberá `migrationsRun: true`, usando o mecanismo nativo de inicialização e mantendo `synchronize: false`.

**Tech Stack:** NestJS 11, TypeORM 0.3, Jest 30, PostgreSQL 16.

## Global Constraints

- A configuração deve valer para `start`, `start:dev` e `start:prod`.
- Uma falha de conexão ou migration deve impedir a inicialização da API.
- `synchronize` deve permanecer desativado.
- Não criar comandos de inicialização paralelos nem alterar migrations existentes.

---

### Task 1: Configuração automática de migrations

**Files:**
- Create: `src/banco/banco.module.spec.ts`
- Modify: `src/banco/banco.module.ts`

**Interfaces:**
- Consumes: `lerConfiguracaoBanco(): ConfiguracaoBanco`
- Produces: `criarOpcoesBanco(): TypeOrmModuleOptions`

- [ ] **Step 1: Escrever o teste que falha**

```typescript
import { criarOpcoesBanco } from './banco.module';

describe('criarOpcoesBanco', () => {
  it('executa migrations no bootstrap sem sincronizar o schema', () => {
    process.env.BANCO_HOST = 'localhost';
    process.env.BANCO_PORTA = '5432';
    process.env.BANCO_USUARIO = 'pelada';
    process.env.BANCO_SENHA = 'pelada';
    process.env.BANCO_NOME = 'gerenciador_pelada';

    const opcoes = criarOpcoesBanco();

    expect(opcoes.migrationsRun).toBe(true);
    expect(opcoes.synchronize).toBe(false);
  });
});
```

- [ ] **Step 2: Confirmar a falha esperada**

Run: `npm test -- banco.module.spec.ts --runInBand`

Expected: FAIL porque `criarOpcoesBanco` ainda não é exportada ou porque
`migrationsRun` ainda é `false`.

- [ ] **Step 3: Implementar a configuração mínima**

```typescript
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
    migrations: [join(__dirname, 'migracoes', '*{.ts,.js}')],
    migrationsRun: true,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
  };
}
```

Usar `useFactory: criarOpcoesBanco` no `TypeOrmModule.forRootAsync`.

- [ ] **Step 4: Confirmar o teste verde**

Run: `npm test -- banco.module.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Verificar integração completa**

Run:

```bash
npm test -- --runInBand
npm run lint
npm run build
npm run migracao:rodar
```

Expected: todos os testes passam, lint e build terminam com código zero, e o
TypeORM informa que não há migrations pendentes ou aplica as pendentes com
sucesso.

- [ ] **Step 6: Commitar**

```bash
git add src/banco/banco.module.ts src/banco/banco.module.spec.ts
git commit -m "feat: rodar migrations ao iniciar backend"
```
