# Eventos Durante a Partida Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar bola cheia, bola murcha e gol contra durante a partida, com placar, desfazer, pontuação e interface mobile consistentes.

**Architecture:** O backend mantém um único evento por ação. `GOL_CONTRA` atualiza o time beneficiado e é interpretado como bola murcha nas projeções de pontuação, ranking e perfil. O frontend preserva o fluxo rápido de gol normal e adiciona bottom sheets específicos para gol contra e destaques.

**Tech Stack:** NestJS 11, TypeORM 0.3, Jest 30, Next.js 16, React 19, TypeScript, Material UI 7, TanStack Query e Vitest.

## Global Constraints

- Eventos só podem ser registrados em partida `EM_ANDAMENTO`.
- `timeId` do gol representa o time beneficiado no placar.
- Gol contra não aceita assistência e conta como uma bola murcha derivada.
- `synchronize` permanece desativado e nenhuma migration nova será criada.
- Ações mobile devem ter alvos de toque de pelo menos 48 px.
- Implementação fica nas árvores `src` dos dois projetos.

---

### Task 1: Registrar gol contra e destaques no backend

**Files:**
- Create: `gerenciador-pelada-backend/src/modulos/peladas/eventos-partida.service.spec.ts`
- Modify: `gerenciador-pelada-backend/src/modulos/peladas/eventos-partida.service.ts`

**Interfaces:**
- Consumes: `TipoEventoPartida`, `PartidaEntity`, `ParticipacaoPartidaEntity`
- Produces: `EventosPartidaService.registrar()` validando status, time, autor e assistência

- [ ] **Step 1: Escrever testes que falham**

Cobrir os seguintes cenários com repositórios em memória:

```typescript
it('credita o gol contra ao adversario do autor', async () => {
  const { servico, partida, eventos } = criarCenario();
  await servico.registrar(DONO, PARTIDA, {
    tipo: TipoEventoPartida.GOL_CONTRA,
    participanteId: VISITANTE,
    timeId: TIME_CASA,
  });
  expect(partida.golsCasa).toBe(1);
  expect(eventos[0].tipo).toBe(TipoEventoPartida.GOL_CONTRA);
});

it('recusa assistencia em gol contra', async () => {
  const { servico } = criarCenario();
  await expect(
    servico.registrar(DONO, PARTIDA, {
      tipo: TipoEventoPartida.GOL_CONTRA,
      participanteId: VISITANTE,
      participanteRelacionadoId: CASA,
      timeId: TIME_CASA,
    }),
  ).rejects.toMatchObject({ codigo: 'GOL_CONTRA_SEM_ASSISTENCIA' });
});

it('registra bola cheia durante a partida sem mudar o placar', async () => {
  const { servico, partida, eventos } = criarCenario();
  await servico.registrar(DONO, PARTIDA, {
    tipo: TipoEventoPartida.BOLA_CHEIA,
    participanteId: CASA,
    timeId: TIME_CASA,
  });
  expect(eventos[0].tipo).toBe(TipoEventoPartida.BOLA_CHEIA);
  expect(partida.golsCasa).toBe(0);
});
```

Também testar partida aguardando/finalizada, time inexistente, gol normal com
autor adversário e gol contra com autor do time beneficiado.

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- eventos-partida.service.spec.ts --runInBand`

Expected: FAIL porque `GOL_CONTRA` não altera o placar e as validações ainda
não existem.

- [ ] **Step 3: Implementar a regra mínima**

```typescript
if (partida.status !== StatusPartida.EM_ANDAMENTO) {
  throw new ErroRegraPelada(
    'PARTIDA_NAO_EM_ANDAMENTO',
    'Eventos so podem ser registrados durante a partida',
  );
}

const ehGol = dto.tipo === TipoEventoPartida.GOL;
const ehGolContra = dto.tipo === TipoEventoPartida.GOL_CONTRA;

if (ehGolContra && dto.participanteRelacionadoId) {
  throw new ErroRegraPelada(
    'GOL_CONTRA_SEM_ASSISTENCIA',
    'Gol contra nao aceita assistencia',
  );
}

if (ehGol || ehGolContra) {
  if (dto.timeId === partida.timeCasaId) partida.golsCasa += 1;
  else partida.golsVisitante += 1;
  await this.partidas.save(partida);
}
```

Validar que `dto.timeId` é casa ou visitante, que gol normal tem autor do mesmo
time e gol contra tem autor do adversário.

- [ ] **Step 4: Confirmar o teste verde**

Run: `npm test -- eventos-partida.service.spec.ts --runInBand`

Expected: PASS.

---

### Task 2: Desfazer e contar bola murcha derivada

**Files:**
- Modify: `gerenciador-pelada-backend/src/modulos/peladas/historico.service.spec.ts`
- Modify: `gerenciador-pelada-backend/src/modulos/peladas/historico.service.ts`
- Modify: `gerenciador-pelada-backend/src/modulos/peladas/partidas.service.spec.ts`
- Modify: `gerenciador-pelada-backend/src/modulos/peladas/partidas.service.ts`
- Modify: `gerenciador-pelada-backend/src/modulos/peladas/rankings.service.spec.ts`
- Modify: `gerenciador-pelada-backend/src/modulos/peladas/rankings.service.ts`
- Create: `gerenciador-pelada-backend/src/modulos/jogadores/perfil-jogador.service.spec.ts`
- Modify: `gerenciador-pelada-backend/src/modulos/jogadores/perfil-jogador.service.ts`

**Interfaces:**
- Consumes: eventos `BOLA_MURCHA` e `GOL_CONTRA`
- Produces: bola murcha total derivada e desfazer simétrico para ambos os gols

- [ ] **Step 1: Escrever testes que falham**

Adicionar:

```typescript
it('desfaz gol contra baixando o placar do time beneficiado', async () => {
  const acao = criarAcao({
    tipo: TipoEventoPartida.GOL_CONTRA,
    timeId: 'time-a',
  });
  const { servico, partida } = criarServico({ acao });
  await servico.desfazer(DONO, PELADA);
  expect(partida.golsCasa).toBe(1);
});
```

Nos testes de pontuação, ranking e perfil, fornecer um evento
`TipoEventoPartida.GOL_CONTRA` e esperar uma bola murcha adicional sem aumentar
os gols do autor.

- [ ] **Step 2: Confirmar as falhas**

Run:

```bash
npm test -- historico.service.spec.ts partidas.service.spec.ts rankings.service.spec.ts perfil-jogador.service.spec.ts --runInBand
```

Expected: FAIL nas expectativas de gol contra derivado.

- [ ] **Step 3: Implementar contagem e desfazer**

No histórico:

```typescript
const alteraPlacar =
  dados.tipo === TipoEventoPartida.GOL ||
  dados.tipo === TipoEventoPartida.GOL_CONTRA;
```

Na pontuação:

```typescript
bolasMurchas:
  contar(participacao.participanteId, TipoEventoPartida.BOLA_MURCHA) +
  contar(participacao.participanteId, TipoEventoPartida.GOL_CONTRA),
```

No ranking e perfil:

```typescript
const bolasMurchas =
  (contagens.get(TipoEventoPartida.BOLA_MURCHA) ?? 0) +
  (contagens.get(TipoEventoPartida.GOL_CONTRA) ?? 0);
```

- [ ] **Step 4: Confirmar os testes verdes**

Executar novamente os quatro arquivos de teste e esperar PASS.

---

### Task 3: Fluxo mobile de gol contra

**Files:**
- Create: `gerenciador-pelada-frontend/src/componentes/pelada/SheetGol.test.tsx`
- Modify: `gerenciador-pelada-frontend/src/componentes/pelada/SheetGol.tsx`
- Modify: `gerenciador-pelada-frontend/src/features/pelada/api.ts`

**Interfaces:**
- Produces: `aoConfirmar({ tipo, timeId, participanteId, participanteRelacionadoId? })`
- Tipos: `tipo: 'GOL' | 'GOL_CONTRA'`

- [ ] **Step 1: Escrever testes que falham**

```typescript
it('registra gol contra para jogador do time adversario', async () => {
  const user = userEvent.setup();
  const aoConfirmar = vi.fn();
  render(<SheetGol {...props} aoConfirmar={aoConfirmar} />);

  await user.click(screen.getByRole('button', { name: 'Time A' }));
  await user.click(screen.getByRole('button', { name: 'Foi gol contra' }));
  await user.click(screen.getByRole('button', { name: 'Bruno' }));

  expect(aoConfirmar).toHaveBeenCalledWith({
    tipo: 'GOL_CONTRA',
    timeId: 'time-a',
    participanteId: 'visitante-1',
  });
});
```

Manter um teste para o fluxo normal com `tipo: 'GOL'` e assistência.

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- src/componentes/pelada/SheetGol.test.tsx`

Expected: FAIL porque a opção `Foi gol contra` não existe.

- [ ] **Step 3: Implementar o fluxo**

Adicionar estado `golContra`, mostrar a ação no passo do autor e, quando ativa,
listar jogadores do time adversário. O toque no autor contra chama
`aoConfirmar` diretamente, sem etapa de assistência.

- [ ] **Step 4: Confirmar o teste verde**

Executar novamente o teste e esperar PASS.

---

### Task 4: Bottom sheet de bola cheia e bola murcha

**Files:**
- Create: `gerenciador-pelada-frontend/src/componentes/pelada/SheetDestaque.test.tsx`
- Create: `gerenciador-pelada-frontend/src/componentes/pelada/SheetDestaque.tsx`
- Modify: `gerenciador-pelada-frontend/src/app/peladas/[id]/page.test.tsx`
- Modify: `gerenciador-pelada-frontend/src/app/peladas/[id]/page.tsx`

**Interfaces:**
- Produces: `aoConfirmar({ tipo, timeId, participanteId })`
- Tipos: `tipo: 'BOLA_CHEIA' | 'BOLA_MURCHA'`

- [ ] **Step 1: Escrever testes que falham**

```typescript
it('confirma bola cheia para o jogador escolhido', async () => {
  const user = userEvent.setup();
  const aoConfirmar = vi.fn();
  render(<SheetDestaque {...props} aoConfirmar={aoConfirmar} />);

  await user.click(screen.getByRole('button', { name: 'Bola cheia' }));
  await user.click(screen.getByRole('button', { name: 'Ana' }));

  expect(aoConfirmar).toHaveBeenCalledWith({
    tipo: 'BOLA_CHEIA',
    timeId: 'time-a',
    participanteId: 'casa-1',
  });
});
```

Na página, testar que `Avaliar` aparece habilitado em partida em andamento e
fica desabilitado fora dela.

- [ ] **Step 2: Confirmar as falhas**

Run:

```bash
npm test -- src/componentes/pelada/SheetDestaque.test.tsx src/app/peladas/[id]/page.test.tsx
```

Expected: FAIL porque componente e botão ainda não existem.

- [ ] **Step 3: Implementar componente e integração**

Criar bottom sheet Material UI com dois botões de tipo e jogadores agrupados
por time. Integrar uma mutation genérica de evento na página, acrescentar o
botão `Avaliar` à barra fixa e fechar o sheet após confirmação.

- [ ] **Step 4: Confirmar os testes verdes**

Executar novamente os testes dos componentes e da página, esperando PASS.

---

### Task 5: Verificação e commits

**Files:**
- Todos os arquivos modificados nas tarefas anteriores.

- [ ] **Step 1: Validar backend**

```bash
npm test -- --runInBand
npm run lint
npm run build
npm run migracao:rodar
npx jest --config ./test/jest-e2e.json --runInBand
```

- [ ] **Step 2: Validar frontend**

```bash
npm test
npm run lint
npm run build
```

- [ ] **Step 3: Revisar**

Executar `git diff --check`, revisar todos os arquivos preparados e verificar
que nenhum segredo foi incluído.

- [ ] **Step 4: Commitar backend**

```bash
git add src
git commit -m "feat: registrar destaques e gol contra"
```

- [ ] **Step 5: Commitar frontend**

```bash
git add src
git commit -m "feat: adicionar destaques e gol contra na partida"
```
