import type { DataSource, EntityManager } from 'typeorm';

/**
 * Quantos dias uma conta excluida espera antes de os dados sumirem de vez.
 *
 * O numero esta escrito na politica de privacidade e na tela de confirmacao do
 * app. Mudar aqui sem mudar la deixa a promessa mentirosa.
 */
export const DIAS_ATE_EXPURGO = 30;

/**
 * Peladas do usuario, e o que pende delas.
 *
 * Repetidos como subconsulta em vez de resolvidos antes porque a lista de ids
 * pode ser grande e porque o passo so precisa valer no instante em que roda —
 * tudo acontece dentro de uma transacao.
 */
const PELADAS = '(SELECT id FROM peladas WHERE organizador_id = $1)';
const PARTIDAS = `(SELECT id FROM partidas WHERE pelada_id IN ${PELADAS})`;
const PARTICIPANTES = `(SELECT id FROM participantes_pelada WHERE pelada_id IN ${PELADAS})`;

/**
 * A ordem de apagar, das folhas para a raiz.
 *
 * Esta lista e o coracao do expurgo, e a ordem dela nao e estetica: o banco
 * protege com RESTRICT o autor de cada gol (`eventos_partida` e
 * `participacoes_partida` apontando para `participantes_pelada`), o participante
 * de cada pelada (apontando para `jogadores`) e o local de cada pelada. Inverter
 * duas linhas nao apaga menos — faz o passo estourar e a transacao inteira
 * voltar atras.
 *
 * Varias tabelas guardam `pelada_id` sem chave estrangeira declarada
 * (`partidas`, `times`, `fila_jogadores`, `pontuacoes_jogador`,
 * `historico_acoes`). O banco nao as apaga em cascata nenhuma, entao elas
 * precisam estar aqui explicitamente, sob pena de virarem lixo orfao apontando
 * para peladas que nao existem mais.
 */
export const PASSOS_DO_EXPURGO: readonly string[] = [
  `DELETE FROM historico_acoes WHERE usuario_id = $1 OR pelada_id IN ${PELADAS}`,
  `DELETE FROM pontuacoes_jogador WHERE pelada_id IN ${PELADAS}`,
  `DELETE FROM eventos_partida WHERE partida_id IN ${PARTIDAS}`,
  `DELETE FROM participacoes_partida WHERE partida_id IN ${PARTIDAS}`,
  `DELETE FROM jogadores_time WHERE participante_id IN ${PARTICIPANTES}`,
  `DELETE FROM fila_jogadores WHERE pelada_id IN ${PELADAS}`,
  `DELETE FROM partidas WHERE pelada_id IN ${PELADAS}`,
  `DELETE FROM times WHERE pelada_id IN ${PELADAS}`,
  `DELETE FROM participantes_pelada WHERE pelada_id IN ${PELADAS}`,
  `DELETE FROM configuracoes_pelada WHERE pelada_id IN ${PELADAS}`,
  `DELETE FROM peladas WHERE organizador_id = $1`,
  `DELETE FROM jogadores WHERE usuario_id = $1`,
  `DELETE FROM locais_pelada WHERE usuario_id = $1`,
  `DELETE FROM temporadas WHERE usuario_id = $1`,
  `DELETE FROM grupos_pelada WHERE organizador_id = $1`,
  `DELETE FROM usuarios WHERE id = $1`,
];

/**
 * Contas cujo prazo venceu.
 *
 * `deletado_em` e o marco: quem excluiu a propria conta pelo app ja saiu do ar
 * naquele instante — o que espera os trinta dias e so o apagar definitivo. Conta
 * removida por administrador entra na mesma regra, que e a mesma promessa.
 *
 * `deletado_em IS NOT NULL` importa tanto quanto a data: sem ele, uma conta viva
 * entraria na lista assim que completasse trinta dias de existencia.
 */
export async function listarContasVencidas(
  gerenciador: EntityManager,
  dias: number = DIAS_ATE_EXPURGO,
): Promise<string[]> {
  const linhas: { id: string }[] = await gerenciador.query(
    `SELECT id FROM usuarios
      WHERE deletado_em IS NOT NULL
        AND deletado_em < now() - ($1 || ' days')::interval
      ORDER BY deletado_em`,
    [String(dias)],
  );
  return linhas.map((linha) => linha.id);
}

/**
 * Apaga de vez tudo que pertence a uma conta.
 *
 * Roda inteiro ou nao roda: se um passo falhar, a transacao volta atras e a
 * conta continua exatamente como estava. Meio expurgo seria pior que nenhum —
 * deixaria ranking sem jogador e partida sem gol.
 */
export async function expurgarConta(
  gerenciador: EntityManager,
  usuarioId: string,
): Promise<void> {
  for (const passo of PASSOS_DO_EXPURGO) {
    await gerenciador.query(passo, [usuarioId]);
  }
}

export interface ResultadoExpurgo {
  expurgadas: string[];
  falhas: { usuarioId: string; motivo: string }[];
}

/**
 * Expurga todas as contas vencidas, uma transacao por conta.
 *
 * Uma transacao por conta, e nao uma para todas, porque uma conta com dado
 * inesperado nao pode impedir o expurgo das outras — cada uma tem um prazo
 * proprio a cumprir.
 */
export async function expurgarContasVencidas(
  fonteDados: DataSource,
  dias: number = DIAS_ATE_EXPURGO,
): Promise<ResultadoExpurgo> {
  const vencidas = await listarContasVencidas(fonteDados.manager, dias);
  const resultado: ResultadoExpurgo = { expurgadas: [], falhas: [] };

  for (const usuarioId of vencidas) {
    try {
      await fonteDados.transaction((gerenciador) =>
        expurgarConta(gerenciador, usuarioId),
      );
      resultado.expurgadas.push(usuarioId);
    } catch (erro) {
      resultado.falhas.push({
        usuarioId,
        motivo: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }

  return resultado;
}
