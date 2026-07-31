# Saída temporária como prancheta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manter o jogador temporariamente fora visível, com a vaga preservada no time e controle manual do organizador, sem alterar silenciosamente a fila.

**Architecture:** `ParticipantePelada.status` representa disponibilidade, `JogadorTime.ativo` preserva a vaga no elenco e `ParticipacaoPartida.saiuEm` representa presença na partida atual. O painel deriva desses três estados, exibe quem está fora dentro do time ou em uma seção separada e delega retorno/troca às rotas existentes, ajustadas para tratar descanso sem movimentar a fila.

**Tech Stack:** NestJS 11, TypeORM 0.3, Jest 30, Next.js 16, React 19, TypeScript, Material UI 9, TanStack Query 5 e Vitest 4.

## Global Constraints

- Não criar migração nem nova entidade.
- Não alterar regras de vitória, empate ou ordem normal da fila.
- O organizador mantém controle manual sobre fila, jogadores em campo e substituições.
- A pausa deve preservar a vaga no time e nunca inserir, remover ou reordenar a fila.
- Usar texto `FORA`, além de cor, para comunicar indisponibilidade.
- Implementar diretamente nos diretórios `src` dos repositórios existentes, sem worktree.

---

### Task 1: Ciclo de pausa e retorno na partida atual

**Files:**
- Modify: `src/modulos/peladas/participantes.service.ts`
- Test: `src/modulos/peladas/pausa-desistencia.spec.ts`

**Interfaces:**
- Consumes: `ParticipantePelada.status`, `JogadorTime.ativo`, `ParticipacaoPartida.saiuEm` e partida `EM_ANDAMENTO`.
- Produces: `pausar(peladaId, participanteId, usuarioId)` fecha a participação sem desativar o elenco; `retornar(...)` reabre a participação quando a vaga ativa ainda pertence a um time em campo.

- [ ] **Step 1: Write the failing pause tests**

```ts
it('pausa fecha a participação atual e preserva a vaga e a fila', async () => {
  await service.pausar('pelada', 'participante', 'organizador');
  expect(participacoes.update).toHaveBeenCalledWith(
    { participanteId: 'participante', saiuEm: IsNull() },
    { saiuEm: expect.any(Date) },
  );
  expect(jogadoresTime.update).not.toHaveBeenCalled();
  expect(fila.save).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --runInBand pausa-desistencia.spec.ts`

Expected: FAIL porque `pausar` ainda desativa `JogadorTime` e não encerra `ParticipacaoPartida`.

- [ ] **Step 3: Implement the preserved-roster pause**

```ts
p.status = StatusParticipantePelada.DESCANSANDO;
const salvo = await this.participantes.save(p);
await this.participacoes.update(
  { participanteId: id, saiuEm: IsNull() },
  { saiuEm: new Date() },
);
return salvo;
```

- [ ] **Step 4: Write and run the failing same-match return test**

```ts
it('retorna ao mesmo time e reabre a participação da partida atual', async () => {
  await service.retornar('pelada', 'participante', 'organizador');
  expect(participacoes.update).toHaveBeenCalledWith(
    { partidaId: 'partida', participanteId: 'participante' },
    { saiuEm: null },
  );
  expect(fila.save).not.toHaveBeenCalled();
});
```

Run: `npm test -- --runInBand pausa-desistencia.spec.ts`

Expected: FAIL até `retornar` localizar a partida em andamento e reabrir a participação.

- [ ] **Step 5: Implement return and verify GREEN**

```ts
const partidaAtual = await this.partidas.findOne({
  where: { peladaId, status: StatusPartida.EM_ANDAMENTO },
});
if (jogadorTimeAtivo && partidaAtual) {
  await this.participacoes.update(
    { partidaId: partidaAtual.id, participanteId: id },
    { saiuEm: null },
  );
}
```

Run: `npm test -- --runInBand pausa-desistencia.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit the lifecycle change**

```bash
git add src/modulos/peladas/participantes.service.ts src/modulos/peladas/pausa-desistencia.spec.ts
git commit -m "fix: preservar vaga ao pausar jogador"
```

### Task 2: Próxima partida, rotação e substituição durante o jogo

**Files:**
- Modify: `src/modulos/peladas/partidas.service.ts`
- Test: `src/modulos/peladas/partidas.service.spec.ts`
- Test: `src/modulos/peladas/rotacao-goleiro.spec.ts`
- Test: `src/modulos/peladas/substituicao.spec.ts`

**Interfaces:**
- Consumes: elenco ativo, status `DESCANSANDO`, partida atual e participante que entra vindo da fila.
- Produces: início reativa o elenco como `JOGANDO`; rotação ignora descansando do time que sai; substituição aceita a vaga preservada e não enfileira quem continua fora.

- [ ] **Step 1: Write failing tests for start and rotation**

```ts
it('marca todo o elenco ativo como jogando ao iniciar a próxima partida', async () => {
  await service.iniciar('pelada', 'partida', 'organizador');
  expect(participantes.update).toHaveBeenCalledWith(
    { id: In(['p1', 'p2']) },
    { status: StatusParticipantePelada.JOGANDO },
  );
});

it('não envia descansando do time perdedor para a fila ou novo time', async () => {
  await service.finalizar('pelada', 'partida', dto, 'organizador');
  expect(filaFinal).not.toContain('descansando');
  expect(novoTime).not.toContain('descansando');
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --runInBand partidas.service.spec.ts rotacao-goleiro.spec.ts`

Expected: FAIL porque o início não muda disponibilidade e a rotação ainda considera todo vínculo ativo.

- [ ] **Step 3: Implement automatic return and rotation filtering**

```ts
await this.participantes.update(
  { id: In(jogadoresDosTimes.map((j) => j.participanteId)) },
  { status: StatusParticipantePelada.JOGANDO },
);

const disponiveis = participantes.filter(
  (p) => p.status !== StatusParticipantePelada.DESCANSANDO,
);
```

- [ ] **Step 4: Write the failing paused-player substitution test**

```ts
it('substitui vaga preservada sem enfileirar quem está descansando', async () => {
  await service.substituir('pelada', 'partida', 'descansando', 'entrada', 'organizador');
  expect(jogadoresTime.update).toHaveBeenCalled();
  expect(participacoes.save).toHaveBeenCalledWith(expect.objectContaining({ participanteId: 'entrada' }));
  expect(filaFinal).not.toContain('descansando');
});
```

- [ ] **Step 5: Implement the two substitution branches**

```ts
const estavaDescansando = participanteSai.status === StatusParticipantePelada.DESCANSANDO;
if (!estavaDescansando) novaFila.push(participanteSaiId);
// A vaga ativa identifica o time mesmo quando a participação atual já foi fechada.
```

- [ ] **Step 6: Run focused backend tests and verify GREEN**

Run: `npm test -- --runInBand partidas.service.spec.ts rotacao-goleiro.spec.ts substituicao.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit match behavior**

```bash
git add src/modulos/peladas/partidas.service.ts src/modulos/peladas/partidas.service.spec.ts src/modulos/peladas/rotacao-goleiro.spec.ts src/modulos/peladas/substituicao.spec.ts
git commit -m "fix: respeitar pausa na partida e rotacao"
```

### Task 3: Painel e troca manual entre partidas

**Files:**
- Modify: `src/modulos/peladas/painel.service.ts`
- Modify: `src/modulos/peladas/fila.service.ts`
- Test: `src/modulos/peladas/painel.service.spec.ts`
- Test: `src/modulos/peladas/fila.service.spec.ts`

**Interfaces:**
- Produces: `JogadorPainel.descansando: boolean` e `Painel.descansando: JogadorPainel[]`, sem duplicar quem ainda está em um time; `entrarNoLugarDe` não adiciona um substituído descansando à fila.
- Consumes: painel e troca manual usados pelo frontend.

- [ ] **Step 1: Write failing panel tests**

```ts
expect(painel.times.atual.jogadores[0]).toMatchObject({ descansando: true });
expect(painel.descansando).toEqual([]);

expect(painelSemVinculo.descansando).toEqual([
  expect.objectContaining({ participanteId: 'legado', descansando: true }),
]);
```

- [ ] **Step 2: Run the panel test and verify RED**

Run: `npm test -- --runInBand painel.service.spec.ts`

Expected: FAIL até o mapeamento expor `descansando` e excluir IDs presentes nos times da seção separada.

- [ ] **Step 3: Implement non-duplicated panel state**

```ts
descansando: participante.status === StatusParticipantePelada.DESCANSANDO,
// Na lista de fora, filtre DESCANSANDO e participanteId ausente dos vínculos ativos.
```

- [ ] **Step 4: Write failing between-match replacement test**

```ts
it('não coloca na fila quem perdeu a vaga enquanto descansava', async () => {
  await service.entrarNoLugarDe('pelada', 'entrada', 'descansando', 'organizador');
  expect(filaFinal).not.toContain('descansando');
});
```

- [ ] **Step 5: Implement the conditional queue insertion and verify GREEN**

```ts
const participanteSai = await manager.findOneByOrFail(ParticipantePelada, { id: saiId });
if (participanteSai.status !== StatusParticipantePelada.DESCANSANDO) {
  novaFila.unshift(saiId);
}
```

Run: `npm test -- --runInBand painel.service.spec.ts fila.service.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit panel and queue behavior**

```bash
git add src/modulos/peladas/painel.service.ts src/modulos/peladas/painel.service.spec.ts src/modulos/peladas/fila.service.ts src/modulos/peladas/fila.service.spec.ts
git commit -m "feat: mostrar jogadores temporariamente fora"
```

### Task 4: Controles mobile de quem está fora

**Files:**
- Modify: `src/features/pelada/api.ts`
- Modify: `src/features/pelada/componentes/CartaoTime.tsx`
- Create: `src/features/pelada/componentes/CartaoTime.test.tsx`
- Modify: `src/features/pelada/componentes/SheetTrocarEmCampo.tsx`
- Create: `src/features/pelada/componentes/SheetTrocarEmCampo.test.tsx`
- Modify: `src/app/peladas/[id]/page.tsx`
- Modify: `src/app/peladas/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `Painel.descansando`, `JogadorPainel.descansando`, `retornarParticipante` e ações existentes de pausa, desistência e substituição.
- Produces: selo `FORA`, ação `Voltar agora` no time, seção `Fora por agora` e atualização do painel após retorno.

- [ ] **Step 1: Add frontend contract and failing component tests**

```tsx
expect(screen.getByText('FORA')).toBeVisible();
expect(screen.getByRole('button', { name: /voltar agora/i })).toBeEnabled();
expect(screen.queryByRole('button', { name: /sair temporariamente/i })).not.toBeInTheDocument();
```

Run: `npm test -- --run src/features/pelada/componentes/CartaoTime.test.tsx src/features/pelada/componentes/SheetTrocarEmCampo.test.tsx`

Expected: FAIL porque os componentes ainda não distinguem descanso.

- [ ] **Step 2: Render the accessible state and contextual bottom sheet**

```tsx
{jogador.descansando && <Chip size="small" label="FORA" />}
{jogador.descansando ? (
  <Button onClick={aoRetornar}>Voltar agora</Button>
) : (
  <Button onClick={aoPausar}>Sair temporariamente</Button>
)}
```

- [ ] **Step 3: Write the failing page return test**

```tsx
expect(screen.getByText('Fora por agora')).toBeVisible();
await user.click(screen.getByRole('button', { name: /voltar.*jogador/i }));
expect(retornarParticipante).toHaveBeenCalledWith('pelada', 'participante');
```

- [ ] **Step 4: Add page mutation, separate section and immediate feedback**

```tsx
const retornarJogador = useMutation({
  mutationFn: (id: string) => retornarParticipante(peladaId, id),
  onSuccess: () => invalidarPainelEParticipantes(),
  onError: mostrarErro,
});
```

- [ ] **Step 5: Run frontend tests and verify GREEN**

Run: `npm test -- --run src/features/pelada/componentes/CartaoTime.test.tsx src/features/pelada/componentes/SheetTrocarEmCampo.test.tsx src/app/peladas/[id]/page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit frontend controls**

```bash
git add src/features/pelada/api.ts src/features/pelada/componentes/CartaoTime.tsx src/features/pelada/componentes/CartaoTime.test.tsx src/features/pelada/componentes/SheetTrocarEmCampo.tsx src/features/pelada/componentes/SheetTrocarEmCampo.test.tsx src/app/peladas/[id]/page.tsx src/app/peladas/[id]/page.test.tsx
git commit -m "feat: gerenciar jogadores temporariamente fora"
```

### Task 5: Verificação integrada e documentação

**Files:**
- Modify only if behavior documentation is stale: `README.md`

**Interfaces:**
- Consumes: todos os comportamentos das tarefas anteriores.
- Produces: backend e frontend compiláveis, testados e com histórico Git limpo para os arquivos da funcionalidade.

- [ ] **Step 1: Run complete backend verification**

Run: `npm test -- --runInBand && npm run lint && npm run build`

Expected: todos os testes passam, ESLint sem erros e Nest compila.

- [ ] **Step 2: Run complete frontend verification**

Run: `npm test && npm run lint && npm run build`

Expected: todos os testes passam, ESLint sem erros e Next.js gera o build.

- [ ] **Step 3: Inspect changes and repository state**

Run: `git diff --check && git status --short && git log -5 --oneline`

Expected: nenhum erro de whitespace e apenas alterações deliberadas, já commitadas ao final.

- [ ] **Step 4: Commit any verification-driven adjustment**

```bash
git add <somente-arquivos-ajustados>
git commit -m "test: validar fluxo de saida temporaria"
```

