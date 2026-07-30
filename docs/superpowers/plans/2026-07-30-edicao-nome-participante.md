# Edição do nome de participante — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a correção do nome de um participante pela tela de chegada
e pela lista geral de jogadores, preservando todos os vínculos existentes.

**Architecture:** Reutilizar o `PATCH /jogadores/:id` existente, porque o nome
pertence ao jogador referenciado pelo participante. Criar um bottom sheet
reutilizável no frontend e conectar as duas telas à mesma função de API,
invalidando todas as consultas que exibem nomes.

**Tech Stack:** Next.js 16, TypeScript, Material UI, TanStack Query, Vitest,
Testing Library, NestJS 11 e TypeORM.

## Global Constraints

- Toda implementação fica em `src`; não usar worktree.
- Não criar migration nem duplicar o nome em `ParticipantePeladaEntity`.
- O nome enviado deve ser aparado e ter entre 2 e 120 caracteres.
- Erros mantêm o editor aberto; sucesso fecha e mostra feedback.
- Não alterar fila, times, status, goleiros, eventos ou pontuação.
- Implementar e verificar o plano completo sem pausas para perguntas.

---

### Task 1: API e bottom sheet reutilizável

**Files:**
- Modify: `gerenciador-pelada-frontend/src/features/participantes/api.ts`
- Create: `gerenciador-pelada-frontend/src/componentes/pelada/SheetEditarNomeJogador.tsx`
- Create: `gerenciador-pelada-frontend/src/componentes/pelada/SheetEditarNomeJogador.test.tsx`

**Interfaces:**
- Produces: `atualizarNomeJogador(jogadorId: string, nome: string): Promise<Jogador>`
- Produces: `SheetEditarNomeJogador` com `jogador`, `salvando`,
  `aoFechar` e `aoSalvar`.

- [ ] **Step 1: Escrever os testes que falham**

Cobrir nome atual preenchido, botão desabilitado para nome inalterado ou curto
e envio de `nome.trim()`:

```tsx
await user.clear(screen.getByRole('textbox', { name: 'Nome' }));
await user.type(screen.getByRole('textbox', { name: 'Nome' }), '  Lucas  ');
await user.click(screen.getByRole('button', { name: 'Salvar' }));
expect(aoSalvar).toHaveBeenCalledWith('Lucas');
```

- [ ] **Step 2: Confirmar RED**

Run: `npm test -- SheetEditarNomeJogador.test.tsx`

Expected: FAIL porque o componente ainda não existe.

- [ ] **Step 3: Implementar o mínimo**

Adicionar:

```ts
export const atualizarNomeJogador = (jogadorId: string, nome: string) =>
  api<Jogador>(`/jogadores/${jogadorId}`, {
    method: 'PATCH',
    body: JSON.stringify({ nome }),
  });
```

O sheet deve ser um `Drawer anchor="bottom"`, usar `TextField` com
`autoFocus`, `slotProps.htmlInput.maxLength = 120`, `Cancelar` e `Salvar`.

- [ ] **Step 4: Confirmar GREEN**

Run: `npm test -- SheetEditarNomeJogador.test.tsx`

Expected: todos os testes do componente passam.

---

### Task 2: Edição pela tela de chegada

**Files:**
- Create: `gerenciador-pelada-frontend/src/componentes/pelada/SheetTirarJogador.test.tsx`
- Modify: `gerenciador-pelada-frontend/src/componentes/pelada/SheetTirarJogador.tsx`
- Create: `gerenciador-pelada-frontend/src/app/peladas/[id]/chegada/page.test.tsx`
- Modify: `gerenciador-pelada-frontend/src/app/peladas/[id]/chegada/page.tsx`

**Interfaces:**
- Consumes: `atualizarNomeJogador` e `SheetEditarNomeJogador` da Task 1.
- Produces: ação `Editar nome` no menu de cada participante.

- [ ] **Step 1: Testar o menu de ações**

Renderizar `SheetTirarJogador` e verificar que `Editar nome` chama
`aoEditar(participante)` sem chamar retirada ou exclusão.

- [ ] **Step 2: Confirmar RED do menu**

Run: `npm test -- SheetTirarJogador.test.tsx`

Expected: FAIL porque a opção de edição não existe.

- [ ] **Step 3: Adicionar a opção de edição**

Alterar o título para `Opções para {nome}` e adicionar uma opção com
`EditOutlined` antes das opções destrutivas.

- [ ] **Step 4: Confirmar GREEN do menu**

Run: `npm test -- SheetTirarJogador.test.tsx`

Expected: PASS.

- [ ] **Step 5: Testar a integração da chegada**

Mockar as consultas e `atualizarNomeJogador`; abrir as opções, escolher
`Editar nome`, alterar o campo e salvar. Verificar:

```ts
expect(atualizarNomeJogador).toHaveBeenCalledWith('jogador-1', 'Lucas');
```

- [ ] **Step 6: Confirmar RED da chegada**

Run: `npm test -- src/app/peladas/[id]/chegada/page.test.tsx`

Expected: FAIL porque a tela ainda não conecta o editor.

- [ ] **Step 7: Conectar a mutação**

Manter `editando: Participante | null`, abrir o editor pela ação do sheet e
pelos chips de desistentes. No sucesso, invalidar `jogadores`,
`participantes`, `painel`, `ranking` e `historico`, fechar e mostrar
`Nome atualizado.`. Trocar o ícone de retirada da linha por `MoreVert` com
rótulo acessível `Opções para {nome}`.

- [ ] **Step 8: Confirmar GREEN da chegada**

Run: `npm test -- src/app/peladas/[id]/chegada/page.test.tsx`

Expected: PASS.

---

### Task 3: Edição pela lista geral de jogadores

**Files:**
- Create: `gerenciador-pelada-frontend/src/app/jogadores/page.test.tsx`
- Modify: `gerenciador-pelada-frontend/src/app/jogadores/page.tsx`

**Interfaces:**
- Consumes: `atualizarNomeJogador` e `SheetEditarNomeJogador`.

- [ ] **Step 1: Escrever o teste que falha**

Carregar um jogador, tocar em `Editar Lucas`, corrigir o nome e verificar a
chamada `atualizarNomeJogador('jogador-1', 'Luccas')`.

- [ ] **Step 2: Confirmar RED**

Run: `npm test -- src/app/jogadores/page.test.tsx`

Expected: FAIL porque não há ação de edição.

- [ ] **Step 3: Implementar a integração**

Adicionar `EditOutlined` antes de remover, estado `editando`, mutação e o sheet
reutilizável. No sucesso, invalidar todas as consultas com nomes, fechar e
mostrar `Nome atualizado.`.

- [ ] **Step 4: Confirmar GREEN**

Run: `npm test -- src/app/jogadores/page.test.tsx`

Expected: PASS.

---

### Task 4: Verificação completa e commits

**Files:**
- Verify: `gerenciador-pelada-backend`
- Verify: `gerenciador-pelada-frontend`

- [ ] **Step 1: Executar frontend completo**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: zero falhas e zero erros.

- [ ] **Step 2: Confirmar backend reutilizado**

Run:

```bash
npx jest jogadores.service.spec.ts --runInBand
npm run build
npm run migracao:rodar
```

Expected: endpoint existente permanece verde e nenhuma migration nova fica
pendente.

- [ ] **Step 3: Revisar alterações**

Verificar `git diff --check`, ausência de segredos, acessibilidade dos botões e
que nenhum arquivo de implementação ficou fora de `src`.

- [ ] **Step 4: Commitar**

Backend:

```bash
git add docs/superpowers/plans/2026-07-30-edicao-nome-participante.md
git commit -m "docs: planejar edicao do nome de participante"
```

Frontend:

```bash
git add src
git commit -m "feat: editar nome dos participantes"
```
