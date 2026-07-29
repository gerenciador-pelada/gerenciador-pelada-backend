import { SorteadorAleatorio } from './sorteador-aleatorio';

const jogador = (id: string, ordem: number, goleiro = false) => ({
  id,
  ordemChegada: ordem,
  ehGoleiroFixo: goleiro,
});

describe('SorteadorAleatorio', () => {
  it('forma dois times com jogadores por ordem e deixa sobras na fila', () => {
    const sorteio = new SorteadorAleatorio(() => 0).sortear(
      [1, 2, 3, 4, 5].map((n) => jogador(`${n}`, n)),
      2,
    );
    expect(sorteio.timeA.linha).toHaveLength(2);
    expect(sorteio.timeB.linha).toHaveLength(2);
    expect(sorteio.fila.map((p) => p.id)).toEqual(['5']);
  });
  it('distribui goleiros fixos sem consumir vagas de linha', () => {
    const sorteio = new SorteadorAleatorio(() => 0).sortear(
      [
        jogador('g1', 1, true),
        jogador('g2', 2, true),
        jogador('1', 3),
        jogador('2', 4),
        jogador('3', 5),
        jogador('4', 6),
      ],
      2,
    );
    expect(sorteio.timeA.goleiro?.id).toBe('g1');
    expect(sorteio.timeB.goleiro?.id).toBe('g2');
  });
});
