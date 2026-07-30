import { RegraEmpate } from '../../comum/enums/regra-empate.enum';
import { ErroRegraPelada } from '../erros/erro-regra-pelada';
import { resolverResultadoFinal } from './finalizacao-pelada';

describe('resolverResultadoFinal', () => {
  it('resolve o vencedor pelo placar sem exigir uma decisao', () => {
    expect(
      resolverResultadoFinal(3, 1, true, RegraEmpate.AMBOS_SAEM),
    ).toEqual({
      empatouNoPlacar: false,
      vencedor: 'CASA',
      vencedorPorDecisao: null,
    });

    expect(
      resolverResultadoFinal(0, 2, false, RegraEmpate.DECISAO_IMEDIATA),
    ).toEqual({
      empatouNoPlacar: false,
      vencedor: 'VISITANTE',
      vencedorPorDecisao: null,
    });
  });

  it('preserva o empate quando ele e permitido', () => {
    expect(
      resolverResultadoFinal(2, 2, true, RegraEmpate.AMBOS_SAEM),
    ).toEqual({
      empatouNoPlacar: true,
      vencedor: null,
      vencedorPorDecisao: null,
    });
  });

  it.each([
    {
      permiteEmpate: false,
      regraEmpate: RegraEmpate.AMBOS_SAEM,
    },
    {
      permiteEmpate: true,
      regraEmpate: RegraEmpate.DECISAO_IMEDIATA,
    },
  ])(
    'exige vencedor no empate com permiteEmpate=$permiteEmpate e regra=$regraEmpate',
    ({ permiteEmpate, regraEmpate }) => {
      expect(() =>
        resolverResultadoFinal(1, 1, permiteEmpate, regraEmpate),
      ).toThrow(
        expect.objectContaining<Partial<ErroRegraPelada>>({
          codigo: 'VENCEDOR_FINAL_OBRIGATORIO',
        }),
      );
    },
  );

  it('mantem o placar empatado e registra o visitante como vencedor da decisao', () => {
    expect(
      resolverResultadoFinal(
        1,
        1,
        false,
        RegraEmpate.AMBOS_SAEM,
        'VISITANTE',
      ),
    ).toEqual({
      empatouNoPlacar: true,
      vencedor: 'VISITANTE',
      vencedorPorDecisao: 'VISITANTE',
    });
  });

  it('ignora uma decisao desnecessaria quando o placar ja define o vencedor', () => {
    expect(
      resolverResultadoFinal(
        4,
        3,
        false,
        RegraEmpate.DECISAO_IMEDIATA,
        'VISITANTE',
      ),
    ).toEqual({
      empatouNoPlacar: false,
      vencedor: 'CASA',
      vencedorPorDecisao: null,
    });
  });
});
