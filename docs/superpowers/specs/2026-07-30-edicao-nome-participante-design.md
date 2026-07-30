# Edição do nome de participante

## Objetivo

Permitir que o organizador corrija um nome digitado errado sem remover o
participante, perder sua posição na fila ou romper o histórico de partidas.

## Decisão de domínio

O nome pertence ao `JogadorEntity`, enquanto `ParticipantePeladaEntity`
representa a participação desse jogador em uma edição da pelada. A correção
atualizará o cadastro único do jogador por meio do endpoint já existente
`PATCH /jogadores/:id`.

Essa decisão mantém uma única identidade e propaga a correção para todas as
peladas, filas, times, eventos, rankings e históricos que exibem o jogador.
Não será criado um nome alternativo por pelada e nenhuma migration será
necessária.

## Alternativas rejeitadas

- Nome específico no participante: adicionaria estado duplicado e permitiria
  nomes divergentes para a mesma pessoa.
- Remover e cadastrar novamente: perderia vínculos e não funcionaria depois
  que o participante já entrou em campo.

## Experiência

### Tela de chegada

- O botão que hoje abre a retirada será apresentado como menu de ações.
- O bottom sheet de ações oferecerá `Editar nome`, `Desistiu da pelada` e
  `Excluir da lista`.
- Participantes desistentes também poderão abrir diretamente a edição pelo
  chip exibido na seção correspondente.

### Tela de jogadores

- Cada jogador terá uma ação explícita de edição antes da ação de remoção.

### Bottom sheet de edição

- Abre preenchido com o nome atual.
- Usa campo único `Nome`, com foco automático e limite de 120 caracteres.
- Só habilita `Salvar` quando o nome aparado tiver entre 2 e 120 caracteres e
  for diferente do atual.
- Informa que a correção aparecerá em todas as peladas e no histórico.
- Permanece aberto se a API recusar a alteração.
- Fecha após sucesso e mostra feedback imediato.

## Dados e validação

O frontend enviará somente `{ nome }` para `PATCH /jogadores/:id`. O backend
existente:

- garante que o jogador pertence ao usuário autenticado;
- remove espaços nas extremidades;
- recusa nomes fora do intervalo de 2 a 120 caracteres;
- recusa outro jogador do mesmo organizador com nome igual.

Não haverá alteração de status do participante, ordem de chegada, fila,
elenco, goleiro, eventos ou pontuação.

## Atualização de estado

Após sucesso, o frontend invalidará consultas de jogadores, participantes,
painéis, rankings e históricos. Assim, qualquer tela aberta depois da
correção recebe o novo nome sem exigir recarregamento manual.

## Erros e acessibilidade

- Erros do backend serão exibidos no feedback já usado pelas telas.
- O campo terá rótulo visível e os botões terão alvos de toque confortáveis.
- As ações de editar e abrir opções terão nomes acessíveis com o nome atual.
- O sheet aceitará fechamento pelo botão `Cancelar` e pelos mecanismos padrão
  do Material UI.

## Testes

- Componente: nome atual preenchido, validação, trim e payload salvo.
- Componente de ações: opção de edição encaminha o participante correto.
- Integração da chegada: edição chama a API com jogador e nome corretos e
  atualiza a interface.
- Integração da lista de jogadores: botão de edição abre o mesmo fluxo.
- Regressão completa: testes, lint e builds dos projetos.
