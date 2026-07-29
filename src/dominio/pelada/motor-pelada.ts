import { RegraEmpate } from '../../comum/enums/regra-empate.enum';
import { ErroRegraPelada } from '../erros/erro-regra-pelada';

export interface JogadorRotacao {
  id: string;
  ordemChegada: number;
}
export interface TimeRotacao {
  id: string;
  jogadores: JogadorRotacao[];
  partidasConsecutivas: number;
}
export interface ResultadoRotacao {
  permanece: TimeRotacao;
  sai: TimeRotacao;
  fila: JogadorRotacao[];
  proximo: JogadorRotacao[];
}

export class MotorPelada {
  static rotacionar(
    vencedor: TimeRotacao,
    perdedor: TimeRotacao,
    fila: JogadorRotacao[],
    tamanho: number,
  ): ResultadoRotacao {
    const proximo = fila.slice(0, tamanho);
    const faltam = tamanho - proximo.length;
    const complemento = [...perdedor.jogadores]
      .sort((a, b) => a.ordemChegada - b.ordemChegada)
      .slice(0, faltam);
    return {
      permanece: vencedor,
      sai: perdedor,
      proximo: [...proximo, ...complemento],
      fila: [
        ...fila.slice(tamanho),
        ...perdedor.jogadores.filter(
          (p) => !complemento.some((c) => c.id === p.id),
        ),
      ].sort((a, b) => a.ordemChegada - b.ordemChegada),
    };
  }
  static empate(
    regra: RegraEmpate,
    casa: TimeRotacao,
    visitante: TimeRotacao,
    vencedorDecisao?: 'CASA' | 'VISITANTE',
  ): TimeRotacao[] {
    if (regra === RegraEmpate.AMBOS_SAEM) return [casa, visitante];
    if (regra === RegraEmpate.MAIS_TEMPO_EM_CAMPO_SAI)
      return [
        casa.partidasConsecutivas >= visitante.partidasConsecutivas
          ? casa
          : visitante,
      ];
    if (!vencedorDecisao)
      throw new ErroRegraPelada(
        'VENCEDOR_DECISAO_OBRIGATORIO',
        'Informe o vencedor da decisao imediata',
      );
    return [vencedorDecisao === 'CASA' ? visitante : casa];
  }
}
