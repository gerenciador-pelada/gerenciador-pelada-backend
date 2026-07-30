# gerenciador-pelada-backend

API do sistema de gerenciamento de peladas de futebol.

## Requisitos

- Node 22+
- Docker, para o PostgreSQL

## Como rodar

```bash
cp .env.example .env
npm install
npm run banco:subir
npm run migracao:rodar
npm run start:dev
```

API em `http://localhost:3001/api` · Swagger em `http://localhost:3001/api/docs`

O cadastro público sempre cria um `ORGANIZADOR`. Para promover a primeira conta a
administrador, veja `CLAUDE.md`.

## Testes

```bash
npm test          # unitários — não precisam de banco
npm run test:e2e  # end-to-end, contra o banco da porta 5433
```

> Os testes e2e do commit `383df58` **nunca foram executados**. Estão versionados
> como ponto de partida, não como suíte confiável.

## Arquitetura

Três camadas, com uma regra inegociável: **`src/dominio/` não importa nada**. Nem
NestJS, nem TypeORM, nem outro módulo. Detalhes em `CLAUDE.md`.

Serviços que alteram o estado da pelada seguem sempre o mesmo ciclo: carregar do
banco → montar objeto de domínio → chamar o domínio → persistir em transação.

Nenhum valor de regra — pontuação, tamanho de time, critério de desempate — é
escrito em código. Tudo vem de `ConfiguracaoPeladaEntity`.

## Decisões que não são óbvias lendo o código

**Isolamento por organizador.** Todo recurso é filtrado pelo dono, e um registro
de outro organizador responde **404**, nunca 403 — responder 403 confirmaria que
aquele id existe.

**O histórico não mente.** Quem já chegou na pelada não pode ser apagado; sai por
desistência, que preserva gols, assistências e pontuação. As chaves estrangeiras
em `participante_id` usam `RESTRICT` para garantir isso mesmo se o código falhar.

**Pontuação e contagem são grandezas diferentes.** Os rankings somam pontos de
`PontuacaoJogador`, já ponderados pelas regras de cada pelada, mas contam gols e
assistências a partir dos eventos. Derivar contagem de pontuação daria zero
sempre que a pelada não pontuar aquele evento — que é o padrão.

**Sortear é começar.** O sorteio dos primeiros times transiciona a pelada para
`EM_ANDAMENTO` sozinho. Exigir uma transição separada criava um passo invisível
em que o sorteio recusava por mais gente presente que houvesse.

**Refazer o sorteio vale até o apito.** Enquanto a partida 1 está `AGUARDANDO`,
um novo sorteio descarta times e partida e recomeça. Depois de iniciada, a via é
a substituição.

**Goleiro fixo fica fora da rotação.** Não entra na fila, não é sorteado, e o
time que assume o lado dele o herda. As vagas de linha continuam sendo
`jogadoresLinhaPorTime` — o goleiro vem além delas.

O organizador pode alterar essa classificação depois da inclusão. Marcar
remove a pessoa da fila de linha; desmarcar a coloca no fim da fila quando ela
já chegou, está disponível e não está em um time. A escalação da partida atual
não é reescrita.

**Pausa e desistência são coisas distintas.** Quem descansa guarda a vaga no
time; quem desiste a perde para alguém da fila.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run start:dev` | Sobe a API em modo watch |
| `npm test` | Testes unitários |
| `npm run banco:subir` | Sobe o PostgreSQL no Docker |
| `npm run migracao:gerar -- src/banco/migracoes/Nome` | Gera migração pelo diff das entidades |
| `npm run migracao:rodar` | Aplica migrações pendentes |

## O que ainda não existe

- **Reabertura de partida e correção de resultado.** Estão na spec. Exigem
  desfazer a rotação, que é destrutiva — precisa do mecanismo de snapshot que a
  spec descreve e que não foi construído.
- **Desfazer** cobre apenas o registro de evento. As demais ações recusam
  explicitamente, em vez de fingir que reverteram.
- **Perfil do jogador** tem endpoint (`GET /jogadores/:id/perfil`), não tem tela.
