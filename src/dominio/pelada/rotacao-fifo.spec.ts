import {
  type JogadorRotacao,
  MotorPelada,
  type TimeRotacao,
} from './motor-pelada';

/**
 * A fila dos proximos e FIFO de verdade.
 *
 * O bug que originou estes testes: numa pelada de times de 6, a fila era
 * `[time completo, Teste 8]`. O time completo entrou, o Teste 8 virou o
 * primeiro da fila e formou o time seguinte na frente de cinco que acabavam de
 * perder. Quando esse time perdeu, a rotacao remontava a fila ordenando por
 * `ordemChegada` — e o Teste 8, que tinha chegado por ultimo na pelada, caia
 * para o fim do proprio grupo e ficava de fora do time seguinte, depois de ter
 * esperado mais que todos eles.
 *
 * O que estes testes protegem nao e um caso, e uma propriedade: **estar na
 * fila ha mais tempo e a unica coisa que da a vez**. A que horas a pessoa
 * chegou na pelada nao entra nessa conta.
 */

const j = (
  id: string,
  ordemChegada: number,
  partidasJogadas = 0,
): JogadorRotacao => ({ id, ordemChegada, partidasJogadas });

const time = (id: string, jogadores: JogadorRotacao[]): TimeRotacao => ({
  id,
  jogadores,
  partidasConsecutivas: 1,
});

const ids = (jogadores: JogadorRotacao[]) => jogadores.map((x) => x.id);

describe('rotacao: a fila e FIFO', () => {
  const TAMANHO = 6;

  // A pelada do relato, com a ordem de chegada de cada um entre parenteses.
  // O Teste 8 chegou por ultimo (19) e esta na frente de todo mundo na fila:
  // e exatamente essa contradicao que fazia a regra errada aparecer.
  const filaInicial = [
    j('J13', 13),
    j('J14', 14),
    j('J15', 15),
    j('J16', 16),
    j('J17', 17),
    j('J18', 18),
    j('Teste8', 19),
  ];

  it('o time completo entra e o Teste 8 fica na frente da fila', () => {
    const perdedor = time('perdedor', [
      j('J01', 1),
      j('J02', 2),
      j('J03', 3),
      j('J04', 4),
      j('J05', 5),
      j('J06', 6),
    ]);

    const { entram, sobra } = MotorPelada.rotacionar(
      [perdedor],
      filaInicial,
      TAMANHO,
    );

    expect(ids(entram)).toEqual(['J13', 'J14', 'J15', 'J16', 'J17', 'J18']);
    expect(ids(sobra)).toEqual([
      'Teste8',
      'J01',
      'J02',
      'J03',
      'J04',
      'J05',
      'J06',
    ]);
  });

  it('o Teste 8 e o primeiro do time formado com quem acabou de perder', () => {
    const fila = [
      j('Teste8', 19),
      j('J01', 1),
      j('J02', 2),
      j('J03', 3),
      j('J04', 4),
      j('J05', 5),
      j('J06', 6),
    ];

    const { entram, sobra } = MotorPelada.rotacionar(
      [time('perdedor', [j('J20', 20), j('J21', 21)])],
      fila,
      TAMANHO,
    );

    expect(ids(entram)).toEqual(['Teste8', 'J01', 'J02', 'J03', 'J04', 'J05']);
    expect(ids(sobra)).toEqual(['J06', 'J20', 'J21']);
  });

  /**
   * O coracao do bug. O time do Teste 8 perde, e ele volta para a fila.
   *
   * Ele entrou como primeiro do time, entao volta como primeiro do grupo —
   * atras de quem ficou esperando, na frente dos companheiros. Ordenar este
   * grupo por `ordemChegada` o jogava para o fim, porque ele chegou por
   * ultimo na pelada.
   */
  it('o time que perde volta na ordem em que entrou, nao por ordem de chegada', () => {
    // A fila fecha o time sozinha, entao o time perdedor volta inteiro — que e
    // a condicao em que a ordem interna dele fica visivel.
    const filaAntes = [
      j('J12', 12),
      j('J13', 13),
      j('J14', 14),
      j('J15', 15),
      j('J16', 16),
      j('J17', 17),
      j('J18', 18),
    ];
    const timeDoTeste8 = time('time do Teste8', [
      j('Teste8', 19),
      j('J01', 1),
      j('J02', 2),
      j('J03', 3),
      j('J04', 4),
      j('J05', 5),
    ]);

    const { entram, sobra } = MotorPelada.rotacionar(
      [timeDoTeste8],
      filaAntes,
      TAMANHO,
    );

    expect(ids(entram)).toEqual(['J12', 'J13', 'J14', 'J15', 'J16', 'J17']);
    expect(ids(sobra)).toEqual([
      // Quem ja esperava continua na frente.
      'J18',
      // E o time perdedor entra atras, na ordem interna que tinha. O Teste8
      // chegou por ultimo na pelada (19) e mesmo assim volta na frente dos
      // companheiros, porque foi ele quem esperou mais para entrar.
      'Teste8',
      'J01',
      'J02',
      'J03',
      'J04',
      'J05',
    ]);
  });

  it('nada reordena quem ja estava esperando', () => {
    // Fila deliberadamente ao contrario da ordem de chegada: se alguma
    // ordenacao por `ordemChegada` sobrar no caminho, ela inverte esta lista.
    const fila = [
      j('entra', 5),
      j('ultimo a chegar', 90),
      j('primeiro a chegar', 1),
    ];

    const { sobra } = MotorPelada.rotacionar(
      [time('perdedor', [j('X', 50)])],
      fila,
      1,
    );

    expect(ids(sobra)).toEqual(['ultimo a chegar', 'primeiro a chegar', 'X']);
  });

  it('com os dois times saindo, casa volta antes do visitante', () => {
    const casa = time('casa', [j('c1', 31), j('c2', 32)]);
    const visitante = time('visitante', [j('v1', 41), j('v2', 42)]);

    const { sobra } = MotorPelada.rotacionar(
      [casa, visitante],
      [j('esperando', 99)],
      1,
    );

    expect(ids(sobra)).toEqual(['c1', 'c2', 'v1', 'v2']);
  });
});

describe('rotacao: FIFO ao longo de varias rodadas', () => {
  /**
   * Joga `rodadas` partidas seguidas em que o desafiante sempre perde, e
   * confere a cada rodada que ninguem furou a fila.
   *
   * A invariante: se A estava na frente de B e nenhum dos dois entrou em
   * campo, A continua na frente de B. Uma rodada isolada nao pega o bug — ele
   * so aparece quando alguem entra, joga e volta, que e quando a posicao
   * precisa ter sobrevivido a partida.
   */
  function jogar(rodadas: number, tamanho: number, pessoas: number) {
    let fila: JogadorRotacao[] = Array.from(
      { length: pessoas - tamanho },
      (_, i) =>
        // Ordem de chegada embaralhada de proposito: quem esta na fila nao tem
        // nenhuma relacao com a hora em que apareceu.
        j(`P${i}`, (pessoas - i) * 7, 0),
    );
    let emCampo: JogadorRotacao[] = Array.from({ length: tamanho }, (_, i) =>
      j(`C${i}`, i + 1, 0),
    );

    const entradas = new Map<string, number>();

    for (let rodada = 0; rodada < rodadas; rodada++) {
      const antes = ids(fila);
      const timeQueSai = ids(emCampo);
      const { entram, sobra } = MotorPelada.rotacionar(
        [time(`rodada-${rodada}`, emCampo)],
        fila,
        tamanho,
      );
      const depois = ids(sobra);

      // Quem continuou esperando manteve a ordem relativa que tinha.
      const aindaEsperando = depois.filter((id) => antes.includes(id));
      expect(aindaEsperando).toEqual(
        antes.filter((id) => aindaEsperando.includes(id)),
      );

      // Quem voltou de campo voltou na ordem em que o time foi montado — que e
      // a ordem de fila que essas pessoas tinham quando entraram. Sem esta
      // checagem a simulacao passa mesmo com a fila sendo reordenada por
      // `ordemChegada`, porque quem volta nunca esteve em `antes`.
      const voltaram = depois.filter((id) => timeQueSai.includes(id));
      expect(voltaram).toEqual(
        timeQueSai.filter((id) => voltaram.includes(id)),
      );

      // E voltaram atras de todo mundo que ja estava parado.
      for (const id of voltaram) {
        for (const esperando of aindaEsperando) {
          expect(depois.indexOf(esperando)).toBeLessThan(depois.indexOf(id));
        }
      }

      for (const jogador of entram) {
        entradas.set(jogador.id, (entradas.get(jogador.id) ?? 0) + 1);
      }

      emCampo = entram.map((x) => ({
        ...x,
        partidasJogadas: x.partidasJogadas + 1,
      }));
      fila = sobra;
    }

    return { entradas, fila, emCampo };
  }

  it('mantem a ordem relativa de quem espera em 12 rodadas seguidas', () => {
    expect(() => jogar(12, 6, 19)).not.toThrow();
  });

  it('nao deixa ninguem preso na fila para sempre', () => {
    // O sintoma que o organizador enxerga: alguem que nunca entra. Com 19
    // pessoas e times de 6, doze rodadas dao voltas de sobra — se alguem
    // ficou com zero entradas, a fila parou de andar para ele.
    const { entradas } = jogar(12, 6, 19);
    const nunca = Array.from({ length: 13 }, (_, i) => `P${i}`).filter(
      (id) => !entradas.has(id),
    );
    expect(nunca).toEqual([]);
  });
});
