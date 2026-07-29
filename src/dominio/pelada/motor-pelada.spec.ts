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
  it('faz sair time com duas vitorias consecutivas no empate', () =>
    expect(
      MotorPelada.empate(
        RegraEmpate.MAIS_TEMPO_EM_CAMPO_SAI,
        {
          id: 'casa',
          jogadores: [],
          partidasConsecutivas: 2,
          vitoriasConsecutivas: 2,
        },
        {
          id: 'v',
          jogadores: [],
          partidasConsecutivas: 2,
          vitoriasConsecutivas: 0,
        },
      )[0].id,
    ).toBe('casa'));
  it('mantem time com uma vitoria e pede escolha sem vencedor anterior', () => {
    expect(
      MotorPelada.empate(
        RegraEmpate.MAIS_TEMPO_EM_CAMPO_SAI,
        {
          id: 'c',
          jogadores: [],
          partidasConsecutivas: 1,
          vitoriasConsecutivas: 1,
        },
        {
          id: 'v',
          jogadores: [],
          partidasConsecutivas: 1,
          vitoriasConsecutivas: 0,
        },
      )[0].id,
    ).toBe('v');
    expect(() =>
      MotorPelada.empate(
        RegraEmpate.MAIS_TEMPO_EM_CAMPO_SAI,
        { id: 'c', jogadores: [], partidasConsecutivas: 0 },
        { id: 'v', jogadores: [], partidasConsecutivas: 0 },
      ),
    ).toThrow('Administrador deve escolher');
  });
});
