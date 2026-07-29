import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../erros/erro-regra-pelada';

/**
 * Transicoes de status permitidas para uma pelada.
 * Uma pelada so avanca: ABERTA_INSCRICOES -> EM_ANDAMENTO -> FINALIZADA.
 * CANCELADA e alcancavel de qualquer estado nao terminal. Nada volta atras.
 */
const TRANSICOES: Readonly<Record<StatusPelada, readonly StatusPelada[]>> = {
  [StatusPelada.ABERTA_INSCRICOES]: [
    StatusPelada.EM_ANDAMENTO,
    StatusPelada.CANCELADA,
  ],
  [StatusPelada.EM_ANDAMENTO]: [
    StatusPelada.FINALIZADA,
    StatusPelada.CANCELADA,
  ],
  [StatusPelada.FINALIZADA]: [],
  [StatusPelada.CANCELADA]: [],
};

export class MaquinaStatusPelada {
  static podeTransicionar(
    atual: StatusPelada,
    desejado: StatusPelada,
  ): boolean {
    return TRANSICOES[atual].includes(desejado);
  }

  static garantirTransicao(atual: StatusPelada, desejado: StatusPelada): void {
    if (!this.podeTransicionar(atual, desejado)) {
      throw new ErroRegraPelada(
        'TRANSICAO_STATUS_INVALIDA',
        `Nao e possivel mudar a pelada de ${atual} para ${desejado}`,
        { statusAtual: atual, statusDesejado: desejado },
      );
    }
  }

  static estaEncerrada(status: StatusPelada): boolean {
    return TRANSICOES[status].length === 0;
  }
}
