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
  vitoriasConsecutivas?: number;
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
    escolhaAdmin?: 'CASA' | 'VISITANTE',
  ): TimeRotacao[] {
    if (regra === RegraEmpate.AMBOS_SAEM) return [casa, visitante];
    if (regra === RegraEmpate.MAIS_TEMPO_EM_CAMPO_SAI) {
      if ((casa.vitoriasConsecutivas ?? 0) >= 2) return [casa];
      if ((visitante.vitoriasConsecutivas ?? 0) >= 2) return [visitante];
      if ((casa.vitoriasConsecutivas ?? 0) === 1) return [visitante];
      if ((visitante.vitoriasConsecutivas ?? 0) === 1) return [casa];
      // Nenhum dos criterios decidiu: os dois times estao com o mesmo tempo em
      // campo. Aqui a escolha e do organizador.
      //
      // `escolhaAdmin` diz quem SAI; `vencedorDecisao` diz quem GANHOU. Sao
      // perguntas diferentes, mas uma responde a outra: se o organizador
      // apontou um vencedor, quem sai e o outro. Aceitar as duas evita recusar
      // uma finalizacao que ja veio decidida — antes disso, escolher o
      // vencedor num empate falhava justamente quando nenhum time tinha
      // vitoria consecutiva.
      const sai =
        escolhaAdmin ??
        (vencedorDecisao === 'CASA'
          ? 'VISITANTE'
          : vencedorDecisao === 'VISITANTE'
            ? 'CASA'
            : undefined);

      if (!sai)
        throw new ErroRegraPelada(
          'ESCOLHA_ADMIN_OBRIGATORIA',
          'Administrador deve escolher quem sai',
        );
      return [sai === 'CASA' ? casa : visitante];
    }
    if (!vencedorDecisao)
      throw new ErroRegraPelada(
        'VENCEDOR_DECISAO_OBRIGATORIO',
        'Informe o vencedor da decisao imediata',
      );
    return [vencedorDecisao === 'CASA' ? visitante : casa];
  }
}
