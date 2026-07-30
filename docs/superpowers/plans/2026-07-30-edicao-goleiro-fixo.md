# Edição de goleiro fixo depois da inclusão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o organizador marque ou desmarque um participante como
goleiro fixo depois de adicioná-lo, mantendo a fila de jogadores de linha
consistente.

**Architecture:** O backend expõe um `PATCH` transacional que atualiza
`ParticipantePelada.ehGoleiroFixo` e reconcilia apenas a fila ativa. O frontend
adiciona uma ação reversível ao bottom sheet já usado na tela de chegada e
invalida participantes e painel depois do sucesso.

**Tech Stack:** NestJS, TypeORM, class-validator, Jest, Next.js, TypeScript,
Material UI, TanStack Query, Vitest e Testing Library.

## Global Constraints

- Não criar migração: `ehGoleiroFixo` já existe em `participantes_pelada`.
- Não remontar nem alterar a escalação da partida atual.
- Ao marcar, retirar o participante da fila de linha.
- Ao desmarcar durante a pelada, enfileirar no fim somente quem já chegou,
  está disponível e não pertence a um time ativo.
- Repetir o valor atual não pode escrever na fila.
- Somente o organizador proprietário pode alterar o participante.
- Toda a implementação deve ficar em `src`.
- A interface deve usar Material UI e manter alvos de toque mobile.

---

### Task 1: API transacional de goleiro fixo

**Files:**
- Create: `src/modulos/peladas/dto/alterar-goleiro-fixo.dto.ts`
- Modify: `src/modulos/peladas/participantes.service.ts`
- Modify: `src/modulos/peladas/participantes.service.spec.ts`
- Modify: `src/modulos/peladas/peladas.controller.ts`

**Interfaces:**
- Consumes: `ParticipantePeladaEntity.ehGoleiroFixo`,
  `FilaJogadorEntity`, `JogadorTimeEntity` e
  `StatusParticipantePelada`.
- Produces:
  `ParticipantesService.alterarGoleiroFixo(usuarioId: string, peladaId: string, participanteId: string, ehGoleiroFixo: boolean): Promise<ParticipantePeladaEntity>`
  e `PATCH /peladas/:id/participantes/:participanteId/goleiro-fixo`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar casos em `participantes.service.spec.ts` com um `EntityManager`
simulado:

```ts
it('marca como goleiro fixo e retira da fila ativa', async () => {
  const { servico, gerenciador, participante } = criarServicoGoleiro(false);

  await servico.alterarGoleiroFixo(DONO, PELADA, participante.id, true);

  expect(participante.ehGoleiroFixo).toBe(true);
  expect(gerenciador.update).toHaveBeenCalledWith(
    FilaJogadorEntity,
    { peladaId: PELADA, participanteId: participante.id, ativo: true },
    { ativo: false, saiuEm: expect.any(Date) },
  );
});

it('desmarca e coloca um jogador disponível no fim da fila', async () => {
  const { servico, gerenciador, participante } = criarServicoGoleiro(true, {
    status: StatusParticipantePelada.AGUARDANDO,
    ordemChegada: 4,
  });

  await servico.alterarGoleiroFixo(DONO, PELADA, participante.id, false);

  expect(gerenciador.create).toHaveBeenCalledWith(
    FilaJogadorEntity,
    expect.objectContaining({
      participanteId: participante.id,
      posicao: 6,
      ativo: true,
    }),
  );
});
```

Acrescentar casos para não enfileirar quem não chegou ou está em time ativo,
idempotência e participante inexistente.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run:

```powershell
npm test -- --runInBand src/modulos/peladas/participantes.service.spec.ts
```

Expected: FAIL porque `alterarGoleiroFixo` ainda não existe.

- [ ] **Step 3: Criar o DTO validado**

Criar `alterar-goleiro-fixo.dto.ts`:

```ts
import { IsBoolean } from 'class-validator';

export class AlterarGoleiroFixoDto {
  @IsBoolean()
  ehGoleiroFixo: boolean;
}
```

- [ ] **Step 4: Implementar a regra transacional**

Em `ParticipantesService`, carregar a pelada pelo organizador, garantir que não
esteja encerrada e executar:

```ts
return this.fonteDados.transaction(async (gerenciador) => {
  const participante = await gerenciador.findOne(
    ParticipantePeladaEntity,
    {
      where: { id: participanteId, peladaId },
      lock: { mode: 'pessimistic_write' },
    },
  );
  if (!participante) {
    throw new NotFoundException('Participante nao encontrado');
  }
  if (participante.ehGoleiroFixo === ehGoleiroFixo) {
    return participante;
  }

  participante.ehGoleiroFixo = ehGoleiroFixo;
  await gerenciador.save(participante);

  if (ehGoleiroFixo) {
    await gerenciador.update(
      FilaJogadorEntity,
      { peladaId, participanteId, ativo: true },
      { ativo: false, saiuEm: new Date() },
    );
    return participante;
  }

  // Só enfileirar na pelada em andamento, depois da chegada, quando estiver
  // disponível, sem time ativo e sem entrada ativa na fila.
  // A posição é MAX(posicao) + 1.
  return participante;
});
```

Usar o `EntityManager` para todas as leituras e escritas da reconciliação, de
modo que flag e fila sejam confirmadas juntas.

- [ ] **Step 5: Expor o controller**

Importar `AlterarGoleiroFixoDto` e adicionar:

```ts
@Patch(':id/participantes/:participanteId/goleiro-fixo')
@ApiOperation({ summary: 'Marca ou desmarca um participante como goleiro fixo' })
alterarGoleiroFixo(
  @UsuarioAtual() u: UsuarioRequisicao,
  @Param('id', ParseUUIDPipe) id: string,
  @Param('participanteId', ParseUUIDPipe) participanteId: string,
  @Body() dto: AlterarGoleiroFixoDto,
) {
  return this.participantes.alterarGoleiroFixo(
    u.id,
    id,
    participanteId,
    dto.ehGoleiroFixo,
  );
}
```

- [ ] **Step 6: Executar os testes do serviço**

Run:

```powershell
npm test -- --runInBand src/modulos/peladas/participantes.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit do backend**

```powershell
git add src/modulos/peladas
git diff --cached --check
git commit -m "feat: editar goleiro fixo do participante"
```

---

### Task 2: Ação mobile na lista de chegada

**Files:**
- Modify: `../gerenciador-pelada-frontend/src/features/participantes/api.ts`
- Modify: `../gerenciador-pelada-frontend/src/componentes/pelada/SheetTirarJogador.tsx`
- Modify: `../gerenciador-pelada-frontend/src/componentes/pelada/SheetTirarJogador.test.tsx`
- Modify: `../gerenciador-pelada-frontend/src/app/peladas/[id]/chegada/page.tsx`
- Modify: `../gerenciador-pelada-frontend/src/app/peladas/[id]/chegada/page.test.tsx`

**Interfaces:**
- Consumes:
  `PATCH /peladas/:peladaId/participantes/:participanteId/goleiro-fixo`.
- Produces:
  `alterarGoleiroFixo(peladaId: string, participanteId: string, ehGoleiroFixo: boolean): Promise<Participante>`
  e a prop
  `aoAlternarGoleiroFixo(participante: Participante): void`.

- [ ] **Step 1: Escrever os testes que falham do bottom sheet**

Adicionar dois testes:

```tsx
it('oferece marcar um jogador de linha como goleiro fixo', async () => {
  const aoAlternar = vi.fn();
  render(
    <SheetTirarJogador
      participante={participante}
      salvando={false}
      aoFechar={vi.fn()}
      aoEditar={vi.fn()}
      aoAlternarGoleiroFixo={aoAlternar}
      aoDesistir={vi.fn()}
      aoExcluir={vi.fn()}
    />,
  );

  await userEvent.click(
    screen.getByRole('button', { name: /Marcar como goleiro fixo/i }),
  );
  expect(aoAlternar).toHaveBeenCalledWith(participante);
});

it('oferece desmarcar quem já é goleiro fixo', () => {
  render(
    <SheetTirarJogador
      participante={{ ...participante, ehGoleiroFixo: true }}
      salvando={false}
      aoFechar={vi.fn()}
      aoEditar={vi.fn()}
      aoAlternarGoleiroFixo={vi.fn()}
      aoDesistir={vi.fn()}
      aoExcluir={vi.fn()}
    />,
  );
  expect(
    screen.getByRole('button', { name: /Desmarcar goleiro fixo/i }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Escrever o teste que falha da integração da página**

Mockar `alterarGoleiroFixo`, abrir as opções de `Lucsa`, tocar em
`Marcar como goleiro fixo` e esperar:

```ts
expect(alterarGoleiroFixo).toHaveBeenCalledWith(
  'pelada-1',
  'participante-1',
  true,
);
```

- [ ] **Step 3: Executar os testes e confirmar a falha**

Run:

```powershell
npm test -- --run src/componentes/pelada/SheetTirarJogador.test.tsx "src/app/peladas/[id]/chegada/page.test.tsx"
```

Expected: FAIL porque a prop, a função da API e a ação ainda não existem.

- [ ] **Step 4: Implementar o cliente da API**

Em `features/participantes/api.ts`:

```ts
export const alterarGoleiroFixo = (
  peladaId: string,
  participanteId: string,
  ehGoleiroFixo: boolean,
) =>
  api<Participante>(
    `/peladas/${peladaId}/participantes/${participanteId}/goleiro-fixo`,
    {
      method: 'PATCH',
      body: JSON.stringify({ ehGoleiroFixo }),
    },
  );
```

- [ ] **Step 5: Implementar a ação no bottom sheet**

Adicionar uma opção com `SportsHandball` e alvo de toque existente:

```tsx
<Opcao
  icone={<SportsHandball />}
  titulo={
    participante.ehGoleiroFixo
      ? 'Desmarcar goleiro fixo'
      : 'Marcar como goleiro fixo'
  }
  ajuda={
    participante.ehGoleiroFixo
      ? 'Volta como jogador de linha e, se estiver fora de um time, entra no fim da fila.'
      : 'Sai da fila de jogadores de linha. A partida atual não é alterada.'
  }
  desabilitado={salvando}
  aoTocar={() => aoAlternarGoleiroFixo(participante)}
/>
```

- [ ] **Step 6: Ligar a ação à página**

Criar uma mutation por `useAcao`, inverter `ehGoleiroFixo`, fechar o sheet e
incluir seu `isPending` em `salvando`. O sucesso deve invalidar as chaves
`participantes` e `painel`, comportamento já centralizado por `useAcao`.

- [ ] **Step 7: Executar os testes focados**

Run:

```powershell
npm test -- --run src/componentes/pelada/SheetTirarJogador.test.tsx "src/app/peladas/[id]/chegada/page.test.tsx"
```

Expected: PASS.

- [ ] **Step 8: Commit do frontend**

```powershell
git add src
git diff --cached --check
git commit -m "feat: alternar goleiro fixo na lista"
```

---

### Task 3: Verificação integrada e documentação

**Files:**
- Modify: `README.md`
- Verify: todos os arquivos alterados nas Tasks 1 e 2

**Interfaces:**
- Consumes: API e ação mobile concluídas.
- Produces: documentação da regra e evidências de testes, lint e build.

- [ ] **Step 1: Documentar a regra**

Acrescentar ao bloco de goleiro fixo no backend:

```md
O organizador pode alterar essa classificação depois da inclusão. Marcar
remove a pessoa da fila de linha; desmarcar a coloca no fim da fila quando ela
já chegou, está disponível e não está em um time.
```

- [ ] **Step 2: Executar a validação completa do backend**

```powershell
npm test -- --runInBand
npm run lint
npm run build
npm run migracao:mostrar
npm run test:e2e
```

Expected: todos os testes passam, lint e build saem com código `0`, e nenhuma
migração fica pendente.

- [ ] **Step 3: Executar a validação completa do frontend**

```powershell
npm test -- --run
npm run lint
npm run build
```

Expected: todos os testes passam, lint e build saem com código `0`.

- [ ] **Step 4: Fazer revisão de segurança e escopo**

```powershell
git diff HEAD^ --check
git diff HEAD^ -- src README.md
git status --short
```

Confirmar que não há segredo, arquivo gerado, alteração de regra de partida ou
migração de banco.

- [ ] **Step 5: Commit da documentação, se necessário**

```powershell
git add README.md docs/superpowers
git diff --cached --check
git commit -m "docs: explicar edicao de goleiro fixo"
```

- [ ] **Step 6: Confirmar estado final**

Nos dois repositórios:

```powershell
git status --short
git log -3 --oneline
```

Expected: árvores limpas e commits da funcionalidade presentes.
