import { RegraEmpate } from '../../comum/enums/regra-empate.enum';
import { MotorPelada } from './motor-pelada';
const j = (id: string, ordemChegada: number) => ({ id, ordemChegada });
describe('MotorPelada', () => {
  it('completa o proximo time com perdedores por chegada', () => {
    const r = MotorPelada.rotacionar(
      { id: 'a', jogadores: [j('a', 1)], partidasConsecutivas: 1 },
      { id: 'b', jogadores: [j('b2', 2), j('b1', 1)], partidasConsecutivas: 1 },
      [j('f', 3)],
      2,
    );
    expect(r.proximo.map((x) => x.id)).toEqual(['f', 'b1']);
  });
  it('faz casa sair no empate de tempo', () =>
    expect(
      MotorPelada.empate(
        RegraEmpate.MAIS_TEMPO_EM_CAMPO_SAI,
        { id: 'casa', jogadores: [], partidasConsecutivas: 2 },
        { id: 'v', jogadores: [], partidasConsecutivas: 2 },
      )[0].id,
    ).toBe('casa'));
});
