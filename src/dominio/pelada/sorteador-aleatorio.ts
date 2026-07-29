import { ErroRegraPelada } from '../erros/erro-regra-pelada';

export interface JogadorSorteio {
  id: string;
  ordemChegada: number;
  ehGoleiroFixo: boolean;
}
export interface ResultadoSorteio {
  timeA: { linha: JogadorSorteio[]; goleiro?: JogadorSorteio };
  timeB: { linha: JogadorSorteio[]; goleiro?: JogadorSorteio };
  fila: JogadorSorteio[];
}

export class SorteadorAleatorio {
  constructor(private readonly aleatorio: () => number = Math.random) {}
  sortear(
    participantes: JogadorSorteio[],
    jogadoresLinhaPorTime: number,
  ): ResultadoSorteio {
    const ordenados = [...participantes].sort(
      (a, b) => a.ordemChegada - b.ordemChegada,
    );
    const goleiros = ordenados.filter((p) => p.ehGoleiroFixo);
    const linha = ordenados.filter((p) => !p.ehGoleiroFixo);
    const necessario = jogadoresLinhaPorTime * 2;
    if (linha.length < necessario)
      throw new ErroRegraPelada(
        'JOGADORES_INSUFICIENTES',
        'Nao ha jogadores de linha suficientes',
        { necessario, disponivel: linha.length },
      );
    const selecionados = linha
      .slice(0, necessario)
      .sort(() => this.aleatorio() - 0.5);
    return {
      timeA: {
        linha: selecionados.slice(0, jogadoresLinhaPorTime),
        goleiro: goleiros[0],
      },
      timeB: {
        linha: selecionados.slice(jogadoresLinhaPorTime),
        goleiro: goleiros[1],
      },
      fila: linha.slice(necessario),
    };
  }
}
