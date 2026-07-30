import { RegraEmpate } from '../../comum/enums/regra-empate.enum';
import { ErroRegraPelada } from '../erros/erro-regra-pelada';

export type LadoPartida = 'CASA' | 'VISITANTE';

export interface ResultadoFinalPelada {
  empatouNoPlacar: boolean;
  vencedor: LadoPartida | null;
  vencedorPorDecisao: LadoPartida | null;
}

/**
 * Resolve o resultado definitivo sem inventar gols.
 *
 * A decisao so existe para desempatar um placar igual quando a configuracao
 * exige vencedor. Em qualquer outro placar, o proprio placar e a fonte de
 * verdade e uma escolha enviada por engano e ignorada.
 */
export function resolverResultadoFinal(
  golsCasa: number,
  golsVisitante: number,
  permiteEmpate: boolean,
  regraEmpate: RegraEmpate,
  vencedorDecisao?: LadoPartida,
): ResultadoFinalPelada {
  if (golsCasa !== golsVisitante) {
    return {
      empatouNoPlacar: false,
      vencedor: golsCasa > golsVisitante ? 'CASA' : 'VISITANTE',
      vencedorPorDecisao: null,
    };
  }

  const exigeVencedor =
    !permiteEmpate || regraEmpate === RegraEmpate.DECISAO_IMEDIATA;

  if (!exigeVencedor) {
    return {
      empatouNoPlacar: true,
      vencedor: null,
      vencedorPorDecisao: null,
    };
  }

  if (!vencedorDecisao) {
    throw new ErroRegraPelada(
      'VENCEDOR_FINAL_OBRIGATORIO',
      'Escolha o vencedor para finalizar a pelada',
    );
  }

  return {
    empatouNoPlacar: true,
    vencedor: vencedorDecisao,
    vencedorPorDecisao: vencedorDecisao,
  };
}
