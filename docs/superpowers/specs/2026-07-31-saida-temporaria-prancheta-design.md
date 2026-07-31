# Saída temporária como prancheta — Design

**Data:** 2026-07-31
**Status:** aprovado pela regra informada pelo produto

## Objetivo

Quem sair temporariamente precisa continuar visível e gerenciável. A pausa não
é uma desistência nem uma substituição definitiva: ela tira a pessoa da partida
atual, preserva sua vaga no time e não altera a fila.

Se o time permanecer para o próximo jogo, o participante volta automaticamente
ao iniciar a nova partida. Caso ainda esteja fora, o organizador substitui essa
pessoa manualmente. O aplicativo funciona como uma prancheta: mostra o estado
real e oferece ações explícitas, sem decidir escondido pelo organizador.

## Fonte de verdade

Os três registros continuam com responsabilidades diferentes:

- `ParticipantePelada.status = DESCANSANDO`: disponibilidade da pessoa;
- `JogadorTime.ativo = true`: vaga preservada no elenco;
- `ParticipacaoPartida.saiuEm != null`: pessoa fora da partida atual.

Não será criada entidade ou migração.

## Pausar durante uma partida

Ao executar `POST /peladas/:peladaId/participantes/:id/pausar`:

1. o participante passa para `DESCANSANDO`;
2. a participação ativa na partida atual recebe `saiuEm`;
3. `JogadorTime` permanece ativo;
4. nenhum registro da fila é criado, removido ou reposicionado.

Com isso, eventos deixam de aceitar a pessoa como estando em campo, mas o time
continua lembrando de quem ocupa a vaga para o próximo jogo.

## Painel

`JogadorPainel` passa a expor `descansando: boolean`.

### Descansando com vaga preservada

A pessoa continua dentro do cartão do próprio time com o selo textual `FORA`.
Ela não é apresentada como alguém disponível na fila. Tocar na linha abre as
ações:

- `Voltar agora`;
- trocar manualmente por alguém da fila;
- `Foi embora — não volta hoje`.

### Descansando sem time

Quem perdeu a vaga por substituição manual, ou já estava no estado legado
criado pelo comportamento anterior, aparece na seção `Fora por agora`.
Essa seção oferece `Voltar`, que coloca a pessoa na frente da fila conforme a
regra já existente.

O painel não duplica uma pessoa: quem aparece descansando dentro de um time não
aparece também na seção separada.

## Próxima partida

### Time permanece

O vínculo ativo é mantido pela rotação. Ao iniciar a próxima partida:

1. uma nova `ParticipacaoPartida` é criada para todo o elenco ativo;
2. participantes do elenco passam para `JOGANDO`;
3. o selo `FORA` desaparece após a atualização do painel.

Se a pessoa continuar indisponível, o organizador toca nela antes de iniciar e
faz a troca manual.

### Time sai

Participantes `DESCANSANDO` não entram na fila automática, não complementam um
novo time e não são herdados como goleiro fixo. Quando o time é dissolvido,
eles ficam na seção `Fora por agora` até o organizador mandar voltar.

## Retorno durante a mesma partida

Ao retornar alguém que ainda possui vínculo ativo com um dos times:

- o status volta para `JOGANDO`;
- a participação encerrada da partida atual é reaberta, preservando o time e o
  papel de goleiro;
- a fila não muda.

Sem vínculo ativo, o comportamento atual permanece: status `PRESENTE` e entrada
na frente da fila.

## Substituição manual

Uma pessoa descansando pode ser escolhida como quem sai:

- o vínculo preservado é transferido para quem entra;
- quem entra sai da fila e passa a jogar;
- quem descansava continua `DESCANSANDO`, fora da fila e visível na seção
  separada;
- durante a partida, a participação de quem entra é criada normalmente.

Uma substituição de quem estava efetivamente em campo mantém a regra atual: o
substituído vai para o fim da fila.

## Compatibilidade com dados existentes

Pessoas já pausadas pelo comportamento anterior possuem `DESCANSANDO` sem
vínculo ativo. O novo painel passa a mostrá-las imediatamente em `Fora por
agora`, permitindo retorno manual sem edição direta no banco.

## Estados de interface

- ações ficam desabilitadas durante gravação;
- sucesso invalida painel e participantes;
- erro mantém o estado anterior e exibe snackbar;
- o selo usa texto, não apenas cor;
- as ações permanecem em bottom sheet com alvos confortáveis para celular.

## Testes

### Backend

- pausar encerra a participação sem desativar o elenco nem tocar na fila;
- retornar reabre a participação quando a vaga está preservada;
- painel marca descanso dentro do time sem duplicar na lista separada;
- painel mostra descanso sem time na lista separada;
- iniciar nova partida muda o elenco ativo para `JOGANDO`;
- rotação não coloca descansando do time que sai na fila ou no novo time;
- substituição de descansando preserva o descanso fora da fila;
- troca entre partidas não joga descansando na fila.

### Frontend

- cartão mostra o selo `FORA`;
- ações de descansando oferecem retorno e troca, mas não uma nova pausa;
- seção `Fora por agora` mostra participantes sem time;
- tocar em `Voltar` chama a API e atualiza o painel.

## Fora do escopo

- alterar regras de vitória, empate ou ordem automática da fila;
- criar banco de reservas separado;
- registrar minutos exatos fora de campo;
- mudar permissões gerais de administrador e organizador.
