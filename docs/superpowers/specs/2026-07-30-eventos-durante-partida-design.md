# Bola cheia, bola murcha e gol contra durante a partida

## Objetivo

Permitir que o organizador registre bola cheia ou bola murcha para um jogador
enquanto a partida estiver em andamento e registrar gols contra com atualização
correta do placar. Todo gol contra deve contar automaticamente como uma bola
murcha para o jogador responsável.

## Regras

- Eventos só podem ser registrados quando a partida estiver `EM_ANDAMENTO`.
- Bola cheia e bola murcha podem ser registradas a qualquer momento para um
  jogador que participa da partida atual.
- Cada registro é um evento independente; o mesmo jogador pode receber mais de
  um destaque durante a partida.
- No gol normal, o autor pertence ao time que recebe o ponto e pode haver
  assistência de um companheiro.
- No gol contra, o autor pertence ao time adversário ao que recebe o ponto.
- Gol contra não aceita assistência.
- `timeId` sempre representa o time que recebe o ponto no placar.
- Gol contra conta como uma bola murcha derivada. Não será criado um segundo
  evento `BOLA_MURCHA`.
- Desfazer o gol contra remove o único evento, diminui o placar do time
  beneficiado e elimina automaticamente sua bola murcha derivada.

## Backend

O enum e o tipo PostgreSQL já possuem `GOL_CONTRA`, `BOLA_CHEIA` e
`BOLA_MURCHA`; nenhuma migration é necessária.

`EventosPartidaService` validará o status, o time e a relação entre autor e
time. Tanto `GOL` quanto `GOL_CONTRA` atualizarão o placar. O histórico
reverterá os dois tipos como eventos de gol.

Pontuação da partida, rankings e perfil individual somarão:

```text
bolas murchas = eventos BOLA_MURCHA + eventos GOL_CONTRA
```

Gols contra não entram na quantidade de gols marcados pelo jogador e não geram
assistência.

## Interface mobile

A barra fixa continuará destacando `Gol` e ganhará a ação `Avaliar`, disponível
somente durante a partida.

`Avaliar` abre um bottom sheet:

1. Escolher `Bola cheia` ou `Bola murcha`.
2. Escolher o jogador, agrupado por time.
3. O toque no jogador confirma e fecha o sheet.

O fluxo de gol normal permanece com os mesmos três passos. Depois de escolher o
time beneficiado, o passo do autor oferece `Foi gol contra`. Ao escolhê-lo, o
sheet mostra somente jogadores do time adversário; tocar no jogador confirma o
gol contra, sem etapa de assistência.

Eventos recentes mostrarão `gol contra`, `bola cheia` ou `bola murcha` usando o
mesmo feedback imediato e a mesma ação de desfazer já existentes.

## Erros e consistência

- Partida aguardando ou finalizada: recusar com erro de regra.
- Time fora da partida: recusar.
- Autor do mesmo time beneficiado em gol contra: recusar.
- Autor adversário em gol normal: recusar.
- Assistência em gol contra: recusar.
- O frontend desabilita as ações durante salvamento e atualiza painel,
  histórico e rankings após sucesso.

## Testes

- Backend: placar do gol contra, validação de times, ausência de assistência,
  destaques durante partida, desfazer e contagem derivada de bola murcha.
- Frontend: fluxo normal preservado, fluxo de gol contra, seleção de destaque e
  payload enviado pela tela principal.
- Verificação completa: testes, lint e build nos dois projetos.
