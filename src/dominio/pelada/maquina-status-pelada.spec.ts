import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../erros/erro-regra-pelada';
import { MaquinaStatusPelada } from './maquina-status-pelada';

describe('MaquinaStatusPelada', () => {
  describe('transicoes permitidas', () => {
    it('permite abrir a pelada para o andamento', () => {
      expect(
        MaquinaStatusPelada.podeTransicionar(
          StatusPelada.ABERTA_INSCRICOES,
          StatusPelada.EM_ANDAMENTO,
        ),
      ).toBe(true);
    });

    it('permite finalizar uma pelada em andamento', () => {
      expect(
        MaquinaStatusPelada.podeTransicionar(
          StatusPelada.EM_ANDAMENTO,
          StatusPelada.FINALIZADA,
        ),
      ).toBe(true);
    });

    it('permite cancelar antes de comecar e durante', () => {
      expect(
        MaquinaStatusPelada.podeTransicionar(
          StatusPelada.ABERTA_INSCRICOES,
          StatusPelada.CANCELADA,
        ),
      ).toBe(true);
      expect(
        MaquinaStatusPelada.podeTransicionar(
          StatusPelada.EM_ANDAMENTO,
          StatusPelada.CANCELADA,
        ),
      ).toBe(true);
    });
  });

  describe('transicoes recusadas', () => {
    it('nao pula direto de aberta para finalizada', () => {
      expect(
        MaquinaStatusPelada.podeTransicionar(
          StatusPelada.ABERTA_INSCRICOES,
          StatusPelada.FINALIZADA,
        ),
      ).toBe(false);
    });

    it('nao volta de em andamento para aberta', () => {
      expect(
        MaquinaStatusPelada.podeTransicionar(
          StatusPelada.EM_ANDAMENTO,
          StatusPelada.ABERTA_INSCRICOES,
        ),
      ).toBe(false);
    });

    it('nao sai de um estado terminal', () => {
      expect(
        MaquinaStatusPelada.podeTransicionar(
          StatusPelada.FINALIZADA,
          StatusPelada.EM_ANDAMENTO,
        ),
      ).toBe(false);
      expect(
        MaquinaStatusPelada.podeTransicionar(
          StatusPelada.CANCELADA,
          StatusPelada.ABERTA_INSCRICOES,
        ),
      ).toBe(false);
    });

    it('nao transiciona para o mesmo status', () => {
      expect(
        MaquinaStatusPelada.podeTransicionar(
          StatusPelada.EM_ANDAMENTO,
          StatusPelada.EM_ANDAMENTO,
        ),
      ).toBe(false);
    });
  });

  describe('garantirTransicao', () => {
    it('nao lanca quando a transicao e valida', () => {
      expect(() =>
        MaquinaStatusPelada.garantirTransicao(
          StatusPelada.ABERTA_INSCRICOES,
          StatusPelada.EM_ANDAMENTO,
        ),
      ).not.toThrow();
    });

    it('lanca ErroRegraPelada com os dois status nos detalhes', () => {
      expect(() =>
        MaquinaStatusPelada.garantirTransicao(
          StatusPelada.FINALIZADA,
          StatusPelada.EM_ANDAMENTO,
        ),
      ).toThrow(ErroRegraPelada);

      try {
        MaquinaStatusPelada.garantirTransicao(
          StatusPelada.FINALIZADA,
          StatusPelada.EM_ANDAMENTO,
        );
      } catch (erro) {
        const regra = erro as ErroRegraPelada;
        expect(regra.codigo).toBe('TRANSICAO_STATUS_INVALIDA');
        expect(regra.detalhes).toEqual({
          statusAtual: StatusPelada.FINALIZADA,
          statusDesejado: StatusPelada.EM_ANDAMENTO,
        });
      }
    });
  });

  describe('estaEncerrada', () => {
    it('reconhece os estados terminais', () => {
      expect(MaquinaStatusPelada.estaEncerrada(StatusPelada.FINALIZADA)).toBe(
        true,
      );
      expect(MaquinaStatusPelada.estaEncerrada(StatusPelada.CANCELADA)).toBe(
        true,
      );
      expect(
        MaquinaStatusPelada.estaEncerrada(StatusPelada.ABERTA_INSCRICOES),
      ).toBe(false);
      expect(MaquinaStatusPelada.estaEncerrada(StatusPelada.EM_ANDAMENTO)).toBe(
        false,
      );
    });
  });
});
