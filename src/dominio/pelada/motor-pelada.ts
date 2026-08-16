import { RegraEmpate } from '../../comum/enums/regra-empate.enum';
import { ErroRegraPelada } from '../erros/erro-regra-pelada';

export interface JogadorRotacao {
  id: string;
  /**
   * A que horas a pessoa apareceu na pelada.
   *
   * Serve para o sorteio inicial e para desempatar entre quem sai junto. **Nao
   * serve para ordenar a fila**: chegar cedo nao e a mesma coisa que estar
   * esperando ha mais tempo, e confundir as duas foi exatamente o que fazia
   * quem chegou por ultimo perder o lugar que ja tinha conquistado.
   */
  ordemChegada: number;
  /**
   * Quantas partidas desta edicao a pessoa ja jogou.
   *
   * E o que diz ha quanto tempo ela esta em campo — diferente de
   * `ordemChegada`, que so diz a que horas ela apareceu na pelada. Quem veio
   * da fila agora jogou menos, mesmo tendo chegado cedo.
   *
   * Nao da para usar a data de entrada no time: o time perdedor e dissolvido
   * e um novo e criado a cada rodada, entao quem fica e quem chega recebem a
   * mesma data.
   */
  partidasJogadas: number;
}
export interface TimeRotacao {
  id: string;
  /**
   * O elenco **na ordem em que o time foi montado**, que e a ordem que essas
   * pessoas tinham na fila quando entraram.
   *
   * Esta ordem e o que carrega a espera atraves da partida, e por isso ela e
   * um contrato, nao um detalhe: quem monta este objeto precisa ler o elenco
   * ordenado por `ordemEntrada`. Entregar aqui o resultado de uma consulta sem
   * `ORDER BY` devolve o time para a fila embaralhado.
   */
  jogadores: JogadorRotacao[];
  partidasConsecutivas: number;
  vitoriasConsecutivas?: number;
}
export interface ResultadoRotacao {
  /** Quem forma o(s) proximo(s) time(s), ja na ordem do novo elenco. */
  entram: JogadorRotacao[];
  /** Quem continua esperando, na ordem da fila. */
  sobra: JogadorRotacao[];
}

export class MotorPelada {
  /**
   * Decide quem entra e quem continua esperando quando uma partida acaba.
   *
   * A fila e FIFO de verdade: quem esta esperando ha mais tempo entra primeiro,
   * e nada reordena quem ja estava parado. Quem sai de campo entra atras de
   * todo mundo que estava aguardando, preservando a ordem interna do time —
   * essa ordem e a propria ordem de fila que eles tinham quando entraram.
   *
   * O caso que motivou isso: numa pelada de times de 6, a fila era
   * `[time completo, Teste 8]`. O time completo entrou, o Teste 8 virou o
   * primeiro da fila e formou o time seguinte na frente de cinco que acabavam
   * de perder. Quando esse time dele perdeu, a rotacao remontava a fila por
   * `ordemChegada` — e o Teste 8, que tinha chegado por ultimo na pelada, caia
   * para o fim do proprio grupo e ficava de fora do time seguinte, depois de
   * ter esperado mais que todos eles.
   *
   * `ordemChegada` continua valendo em um lugar so: desempatar entre os que
   * saem do mesmo time disputando as vagas que a fila nao preencheu.
   */
  static rotacionar(
    saem: TimeRotacao[],
    fila: JogadorRotacao[],
    vagas: number,
  ): ResultadoRotacao {
    const jogadoresQueSaem = saem.flatMap((time) => time.jogadores);
    const daFila = fila.slice(0, vagas);
    const naFila = new Set(fila.map((jogador) => jogador.id));

    // Quando a fila nao fecha o time, quem completa e quem jogou menos — nao
    // quem chegou mais cedo na pelada.
    //
    // Ordenar por `ordemChegada` aqui punia justamente quem acabou de entrar:
    // vinha da fila para preencher uma vaga, o time perdia em seguida, e ele
    // saia na mesma hora, enquanto alguem que estava em campo ha quatro
    // partidas ficava. Quem acabou de entrar e o ultimo a sair.
    const complemento = jogadoresQueSaem
      .filter((jogador) => !naFila.has(jogador.id))
      .sort(
        (a, b) =>
          a.partidasJogadas - b.partidasJogadas ||
          a.ordemChegada - b.ordemChegada,
      )
      .slice(0, Math.max(0, vagas - daFila.length));

    const entram = [...daFila, ...complemento];
    const entrou = new Set(entram.map((jogador) => jogador.id));

    return {
      entram,
      sobra: [
        // Quem ja esperava mantem exatamente a posicao que tinha. Nenhuma
        // ordenacao passa por cima desta lista.
        ...fila.slice(daFila.length),
        // E quem sai de campo entra atras deles, na ordem do proprio time.
        // Quando os dois times saem (empate com AMBOS_SAEM), vale a ordem em
        // que `saem` chega: casa antes do visitante.
        ...jogadoresQueSaem.filter((jogador) => !entrou.has(jogador.id)),
      ],
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
