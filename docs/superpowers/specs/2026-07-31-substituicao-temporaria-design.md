# Substituição temporária — Design

**Data:** 2026-07-31
**Status:** aprovado pela regra informada pelo produto e pela autorização de execução contínua

## Objetivo

Permitir que o organizador coloque alguém da fila no lugar de um jogador
temporariamente fora sem transferir definitivamente a vaga do time. O aplicativo
deve representar o titular e seu substituto como uma prancheta real.

## Modelo

`JogadorTime` recebe `substituiParticipanteId`, opcional e referenciando o
participante cuja vaga está sendo coberta. Um vínculo sem esse campo é parte do
elenco permanente; um vínculo com esse campo é uma cobertura temporária.

O titular permanece com `JogadorTime.ativo = true` e
`ParticipantePelada.status = DESCANSANDO`. O substituto recebe vínculo ativo no
mesmo time e participa da partida, mas não se torna dono definitivo da vaga.

## Colocar substituto

Ao tocar no jogador `FORA` e escolher alguém da fila:

1. o vínculo do titular permanece ativo;
2. o substituto recebe um novo vínculo com `substituiParticipanteId` apontando
   para o titular;
3. o substituto permanece na mesma posição da fila enquanto cobre a vaga;
4. durante uma partida, recebe `ParticipacaoPartida` no mesmo time;
5. o titular continua `DESCANSANDO` e fora da fila;
6. o painel mostra os dois no cartão: titular com `FORA` e substituto com
   `NO LUGAR DE <nome>`.

Não pode existir mais de um substituto ativo para o mesmo titular.

## Retorno durante a partida

Ao mandar o titular voltar:

1. a participação do substituto é encerrada;
2. o vínculo temporário é desativado;
3. a posição do substituto na fila permanece inalterada;
4. a participação do titular é reaberta;
5. o titular volta para `JOGANDO`.

## Finalização da partida

### Time permanece

Os substitutos temporários do time que permanece saem do elenco e continuam na
posição que já ocupavam na fila. O titular mantém sua vaga. Ao iniciar a próxima partida, titulares sem
novo substituto voltam automaticamente para `JOGANDO`.

Se o titular continuar fora, o organizador escolhe novamente quem o cobre antes
ou durante a partida seguinte. Havendo um substituto temporário ativo, o início
da partida não escala nem reativa o titular.

### Time sai

O titular `DESCANSANDO` continua excluído da rotação e da fila. O substituto
continua elegível pela posição que já ocupava na fila e não pode ser duplicado
ao participar da rotação do time que saiu.

## Troca do próprio substituto

Se o organizador troca o substituto durante a partida, quem entra herda
`substituiParticipanteId`. A cobertura continua temporária e ainda pertence à
vaga do mesmo titular.

## Painel e interface

`JogadorPainel` passa a expor `substituiParticipanteId` e
`substituiNome`. O cartão mantém o titular `FORA` e identifica o substituto com
texto, não apenas cor. A mesma ação existente de escolher alguém da fila será
usada; não haverá uma segunda tela ou funcionalidade paralela.

## Banco e compatibilidade

Uma migration adiciona a coluna UUID nullable e a chave estrangeira com
`ON DELETE SET NULL`, além de índice único parcial para impedir duas coberturas
ativas do mesmo titular. Registros atuais permanecem vínculos permanentes porque
a coluna nasce nula. Uma migration de reparo recoloca no fim da fila somente
substitutos ativos removidos por versões anteriores; depois disso, novas
coberturas preservam a posição original.

## Testes

- troca de `DESCANSANDO` preserva titular e cria vínculo temporário;
- retorno encerra substituto sem alterar sua posição na fila;
- início não escala titular que possui substituto ativo;
- time vencedor preserva a posição do substituto na fila e o titular;
- time perdedor rotaciona substituto e ignora titular descansando;
- troca do substituto propaga a relação temporária;
- painel expõe titular e substituto sem duplicar fila;
- cartão mostra `FORA` e `NO LUGAR DE`;
- fluxo existente de substituição definitiva continua inalterado.

## Fora do escopo

- múltiplos substitutos simultâneos para a mesma vaga;
- histórico estatístico específico de substituições;
- alterar vitória, empate, goleiros ou pontuação.
