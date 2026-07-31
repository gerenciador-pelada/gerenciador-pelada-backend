# Substituição temporária — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrir temporariamente a vaga de quem está `FORA`, devolvendo o substituto à fila quando o titular retorna ou o time permanece.

**Architecture:** `JogadorTime.substituiParticipanteId` identifica um vínculo temporário. Serviços de fila e partida preservam o vínculo do titular, propagam a cobertura em novas trocas e resolvem a cobertura no retorno ou na rotação; o painel apenas expõe a relação persistida.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL 16, Jest 30, Next.js 16, React 19, Material UI 9 e Vitest 4.

## Global Constraints

- A saída temporária do titular não altera a fila.
- Somente um substituto ativo pode cobrir cada titular.
- O titular permanece visível no time com `FORA`.
- O substituto preserva sua posição na fila enquanto cobre a vaga e quando o titular reassume.
- Se o time sai, o substituto participa da rotação normal e o titular descansando não entra nela.
- Implementar diretamente em `src` e executar migrations no banco Docker local.

---

### Task 1: Persistir a relação de cobertura

**Files:**
- Create: `src/banco/migracoes/1785530000000-AdicionarSubstituicaoTemporaria.ts`
- Modify: `src/banco/migracoes.ts`
- Modify: `src/banco/entidades/jogador-time.entity.ts`

**Interfaces:**
- Produces: `JogadorTimeEntity.substituiParticipanteId: string | null` e relação opcional `substituiParticipante`.

- [ ] **Step 1: Add the nullable entity contract**

```ts
@Column({ type: 'uuid', nullable: true })
substituiParticipanteId: string | null;
```

- [ ] **Step 2: Add and register the migration**

```sql
ALTER TABLE "jogadores_time" ADD COLUMN "substitui_participante_id" uuid;
ALTER TABLE "jogadores_time" ADD CONSTRAINT "fk_jogadores_time_substitui" FOREIGN KEY (...) REFERENCES "participantes_pelada"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX "uq_jogadores_time_substituto_ativo" ON "jogadores_time" ("substitui_participante_id") WHERE "ativo" = true AND "substitui_participante_id" IS NOT NULL;
```

- [ ] **Step 3: Run build and migration**

Run: `npm run build && npm run migracao:rodar`

Expected: build succeeds and migration `1785530000000` is applied.

- [ ] **Step 4: Commit persistence**

```bash
git add src/banco/entidades/jogador-time.entity.ts src/banco/migracoes.ts src/banco/migracoes/1785530000000-AdicionarSubstituicaoTemporaria.ts
git commit -m "feat: persistir substituicao temporaria"
```

### Task 2: Colocar e trocar substitutos

**Files:**
- Modify: `src/modulos/peladas/fila.service.ts`
- Modify: `src/modulos/peladas/fila.service.spec.ts`
- Modify: `src/modulos/peladas/partidas.service.ts`
- Modify: `src/modulos/peladas/substituicao.spec.ts`

**Interfaces:**
- Consumes: titular `DESCANSANDO`, fila ativa e `substituiParticipanteId`.
- Produces: troca entre partidas cria vínculo adicional; troca durante partida cria participação e propaga a cobertura.

- [ ] **Step 1: Write failing tests**

```ts
expect(vinculoTitular).not.toHaveBeenUpdated();
expect(vinculoSubstituto).toMatchObject({
  participanteId: 'entra',
  substituiParticipanteId: 'titular',
});
expect(filaFinal).not.toContain('titular');
```

Run: `npx jest --runInBand fila.service.spec.ts substituicao.spec.ts`

Expected: FAIL porque as trocas atuais transferem/desativam a vaga do titular.

- [ ] **Step 2: Implement temporary branches**

```ts
const substituiParticipanteId = estavaDescansando
  ? saiId
  : membroSai?.substituiParticipanteId ?? null;
```

Entre partidas, criar vínculo adicional quando o titular está descansando. Durante a partida, manter o titular e criar participação apenas para quem entra. Em uma troca do próprio substituto, copiar `substituiParticipanteId`.

- [ ] **Step 3: Verify and commit**

Run: `npx jest --runInBand fila.service.spec.ts substituicao.spec.ts`

Expected: PASS.

```bash
git add src/modulos/peladas/fila.service.ts src/modulos/peladas/fila.service.spec.ts src/modulos/peladas/partidas.service.ts src/modulos/peladas/substituicao.spec.ts
git commit -m "feat: colocar substituto temporario no time"
```

### Task 3: Resolver retorno, início e rotação

**Files:**
- Modify: `src/modulos/peladas/participantes.service.ts`
- Modify: `src/modulos/peladas/pausa-desistencia.spec.ts`
- Modify: `src/modulos/peladas/partidas.service.ts`
- Modify: `src/modulos/peladas/partidas.service.spec.ts`
- Modify: `src/modulos/peladas/rotacao-goleiro.spec.ts`

**Interfaces:**
- Produces: retorno encerra cobertura sem alterar a fila; início escala titular somente sem cobertura; rotação limpa coberturas do time que permanece.

- [ ] **Step 1: Write failing return test**

```ts
expect(vinculoTemporario.ativo).toBe(false);
expect(participacaoSubstituto.saiuEm).toBeInstanceOf(Date);
expect(filaFinal).toContainEqual(
  expect.objectContaining({ participanteId: 'substituto', posicao: posicaoOriginal }),
);
expect(participacaoTitular.saiuEm).toBeNull();
```

- [ ] **Step 2: Implement transactional return cleanup**

Localizar o vínculo ativo com `substituiParticipanteId = titular`, encerrá-lo e fechar sua participação atual sem reescrever a fila antes de reabrir o titular.

- [ ] **Step 3: Write failing start and winner tests**

```ts
expect(participacoesCriadas).not.toContainEqual(
  expect.objectContaining({ participanteId: 'titular-coberto' }),
);
expect(filaPosJogo).toContainEqual(
  expect.objectContaining({ id: 'substituto-vencedor', posicao: posicaoOriginal }),
);
expect(vinculoTitular.ativo).toBe(true);
```

- [ ] **Step 4: Implement start filtering and winner cleanup**

No início, excluir IDs referenciados por vínculos temporários. Na rotação, temporários do time que permanece são desativados sem mudar a fila; no time que sai não podem ser duplicados entre fila e `TimeRotacao.jogadores`.

- [ ] **Step 5: Verify and commit**

Run: `npx jest --runInBand pausa-desistencia.spec.ts partidas.service.spec.ts rotacao-goleiro.spec.ts substituicao.spec.ts`

Expected: PASS.

```bash
git add src/modulos/peladas/participantes.service.ts src/modulos/peladas/pausa-desistencia.spec.ts src/modulos/peladas/partidas.service.ts src/modulos/peladas/partidas.service.spec.ts src/modulos/peladas/rotacao-goleiro.spec.ts
git commit -m "feat: devolver substituto ao titular e a fila"
```

### Task 4: Expor a relação no painel e no cartão

**Files:**
- Modify: `src/modulos/peladas/painel.service.ts`
- Modify: `src/modulos/peladas/painel.service.spec.ts`
- Modify: `../gerenciador-pelada-frontend/src/features/pelada/api.ts`
- Modify: `../gerenciador-pelada-frontend/src/componentes/pelada/CartaoTime.tsx`
- Modify: `../gerenciador-pelada-frontend/src/componentes/pelada/CartaoTime.test.tsx`

**Interfaces:**
- Produces: `JogadorPainel.substituiParticipanteId` e `substituiNome`, renderizados como `NO LUGAR DE <nome>`.

- [ ] **Step 1: Write failing backend and frontend tests**

```ts
expect(jogadorSubstituto).toMatchObject({
  substituiParticipanteId: 'titular',
  substituiNome: 'Ana',
});
expect(screen.getByText('NO LUGAR DE ANA')).toBeVisible();
```

- [ ] **Step 2: Implement mapping and accessible badge**

Mapear a relação a partir do elenco e renderizar um `Chip` textual no cartão, preservando `FORA` no titular.

- [ ] **Step 3: Verify and commit both repositories**

Run backend: `npx jest --runInBand painel.service.spec.ts`

Run frontend: `npm test -- src/componentes/pelada/CartaoTime.test.tsx`

Expected: PASS.

```bash
git commit -m "feat: identificar substituto temporario no painel"
```

### Task 5: Verificação integrada

**Files:**
- No production file expected beyond verification-driven corrections.

**Interfaces:**
- Produces: bancos migrados, processos locais carregando os artefatos novos e repositórios limpos.

- [ ] **Step 1: Run backend verification**

Run: `npm test -- --runInBand && npm run lint && npm run build && npx jest --config ./test/jest-e2e.json --runInBand`

- [ ] **Step 2: Run frontend verification**

Run: `npm test && npm run lint && npm run build`

- [ ] **Step 3: Restart backend and verify health**

Reiniciar somente o processo `node dist/main`, confirmar HTTP 200 em `/api/docs-json` e preservar os bancos Docker.

- [ ] **Step 4: Inspect repository state**

Run in both repositories: `git diff --check && git status --short && git log -5 --oneline`

Expected: no uncommitted feature changes and no whitespace errors.
