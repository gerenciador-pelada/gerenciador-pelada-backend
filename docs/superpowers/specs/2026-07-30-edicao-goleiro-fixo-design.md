# Edição de goleiro fixo depois da inclusão — Design

**Data:** 2026-07-30
**Status:** aprovado pela regra informada pelo produto

## Objetivo

Permitir que o organizador marque ou desmarque um participante como goleiro
fixo depois de ele já ter sido incluído na lista da pelada, sem precisar
excluir e cadastrar a pessoa novamente.

## Experiência

A ação fica no mesmo bottom sheet de opções do participante usado para editar
o nome, registrar desistência e excluir uma inclusão incorreta.

- jogador de linha: `Marcar como goleiro fixo`;
- goleiro fixo: `Desmarcar goleiro fixo`;
- a ajuda da ação explica o efeito sobre a fila antes do toque;
- a lista atualiza o ícone de goleiro imediatamente após a confirmação do
  servidor;
- o feedback é exibido por snackbar;
- enquanto a operação estiver pendente, as ações ficam desabilitadas.

Não há confirmação adicional: a operação é reversível e precisa ser rápida no
celular.

## Regra de domínio

`ParticipantePelada.ehGoleiroFixo` continua sendo a fonte de verdade da
classificação.

### Marcar como goleiro fixo

1. Atualiza `ehGoleiroFixo` para `true`.
2. Se houver uma entrada ativa na fila de jogadores de linha, desativa essa
   entrada e registra o horário de saída.
3. Não altera a escalação nem a participação da partida atual.

### Desmarcar goleiro fixo

1. Atualiza `ehGoleiroFixo` para `false`.
2. Se a pelada ainda não começou ou o participante ainda não chegou, não cria
   fila: o sorteio ou a chegada continuarão cuidando disso.
3. Com a pelada em andamento, o participante entra no fim da fila somente se:
   - já chegou;
   - está `PRESENTE` ou `AGUARDANDO`;
   - não pertence a um time ativo;
   - ainda não possui entrada ativa na fila.
4. Se estiver em um time, a partida atual não é reescrita. A nova
   classificação vale para as formações seguintes.

Entrar no fim da fila evita que alternar a função seja usado para furar a ordem
de quem já aguardava.

### Idempotência

Enviar o valor que o participante já possui devolve o estado atual sem criar,
remover ou reposicionar registros de fila.

### Pelada encerrada

A edição reutiliza a regra existente de pelada aberta. Peladas finalizadas ou
canceladas recusam a alteração.

## API

```http
PATCH /peladas/:peladaId/participantes/:participanteId/goleiro-fixo
Content-Type: application/json

{
  "ehGoleiroFixo": true
}
```

O corpo é validado como booleano obrigatório. O endpoint usa a autorização já
existente: somente o organizador proprietário da pelada pode executá-lo.

A atualização do participante e da fila ocorre em uma única transação.

## Estados e erros

- participante inexistente ou pertencente a outra pelada: `404`;
- pelada inexistente ou de outro organizador: `404`;
- pelada encerrada: erro de regra existente;
- valor ausente ou não booleano: `400`;
- falha da operação: a interface mantém o valor anterior e mostra a mensagem
  retornada pela API.

## Fora do escopo

- escolher o lado ou time do goleiro;
- transformar um goleiro avulso em membro permanente do time atual;
- remontar uma partida já iniciada;
- alterar as regras de sorteio, rotação ou goleiro avulso;
- criar migração de banco, pois a coluna já existe.

## Testes

### Backend

- marca goleiro e remove a entrada ativa da fila;
- desmarca goleiro disponível e o coloca no fim da fila;
- não enfileira quem ainda não chegou;
- não enfileira quem está em um time ativo;
- repetir o mesmo valor não escreve na fila;
- recusa participante inexistente.

### Frontend

- jogador de linha vê a ação de marcar;
- goleiro fixo vê a ação de desmarcar;
- a ação envia o valor invertido para a API;
- a tela invalida participantes e painel depois do sucesso;
- a lista passa a refletir o ícone devolvido pelo servidor.
