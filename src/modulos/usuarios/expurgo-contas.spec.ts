import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DIAS_ATE_EXPURGO,
  PASSOS_DO_EXPURGO,
  expurgarConta,
  listarContasVencidas,
} from './expurgo-contas';

const PASTA_ENTIDADES = join(__dirname, '..', '..', 'banco', 'entidades');

/** Tabela apagada por cada passo, na ordem em que os passos rodam. */
const tabelasNaOrdem = PASSOS_DO_EXPURGO.map((passo) => {
  const achado = /^DELETE FROM (\w+)/.exec(passo);
  if (!achado) throw new Error(`Passo sem tabela: ${passo}`);
  return achado[1];
});

const posicao = (tabela: string) => tabelasNaOrdem.indexOf(tabela);

describe('expurgo de contas', () => {
  /**
   * O risco real desta rotina nao e ela quebrar — e ela continuar passando
   * enquanto silenciosamente deixa dado para tras. Uma tabela nova entra no
   * sistema, ninguem lembra do expurgo, e a promessa de apagar em trinta dias
   * vira mentira sem que nada acuse.
   */
  it('cobre todas as tabelas do banco', () => {
    const tabelasDoBanco = readdirSync(PASTA_ENTIDADES)
      .filter((arquivo) => arquivo.endsWith('.entity.ts'))
      .map((arquivo) => {
        const fonte = readFileSync(join(PASTA_ENTIDADES, arquivo), 'utf8');
        const achado = /@Entity\('(\w+)'\)/.exec(fonte);
        if (!achado) throw new Error(`Entidade sem @Entity: ${arquivo}`);
        return achado[1];
      });

    expect(tabelasDoBanco.length).toBeGreaterThan(0);
    expect([...tabelasDoBanco].sort()).toEqual([...tabelasNaOrdem].sort());
  });

  /**
   * A ordem nao e estetica: o banco protege com RESTRICT o autor de cada gol, o
   * participante de cada pelada e o local de cada pelada. Cada par abaixo e uma
   * restricao que existe no schema — inverte-la faz o passo estourar.
   */
  it.each([
    ['eventos_partida', 'participantes_pelada'],
    ['participacoes_partida', 'participantes_pelada'],
    ['eventos_partida', 'partidas'],
    ['participacoes_partida', 'partidas'],
    ['jogadores_time', 'participantes_pelada'],
    ['fila_jogadores', 'participantes_pelada'],
    ['participacoes_partida', 'times'],
    ['participantes_pelada', 'jogadores'],
    ['participantes_pelada', 'peladas'],
    ['configuracoes_pelada', 'peladas'],
    ['peladas', 'locais_pelada'],
    ['peladas', 'grupos_pelada'],
    ['peladas', 'temporadas'],
  ])('apaga %s antes de %s', (antes, depois) => {
    expect(posicao(antes)).toBeGreaterThanOrEqual(0);
    expect(posicao(antes)).toBeLessThan(posicao(depois));
  });

  it('apaga a linha do usuario por ultimo', () => {
    expect(tabelasNaOrdem.at(-1)).toBe('usuarios');
  });

  it('escopa todo passo ao usuario recebido — nenhum apaga a tabela inteira', () => {
    for (const passo of PASSOS_DO_EXPURGO) {
      expect(passo).toContain('WHERE');
      expect(passo).toContain('$1');
    }
  });

  it('executa os passos na ordem declarada, com o id do usuario', async () => {
    const query = jest.fn().mockResolvedValue([]);

    await expurgarConta({ query } as never, 'usuario-1');

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      ...PASSOS_DO_EXPURGO,
    ]);
    for (const [, parametros] of query.mock.calls) {
      expect(parametros).toEqual(['usuario-1']);
    }
  });

  describe('listarContasVencidas', () => {
    /**
     * Sem o `IS NOT NULL`, toda conta viva com mais de trinta dias de existencia
     * entraria na lista — e o expurgo apagaria o app inteiro.
     */
    it('so olha conta ja excluida, e so depois do prazo', async () => {
      const query = jest.fn().mockResolvedValue([]);

      await listarContasVencidas({ query } as never);

      const [sql, parametros] = query.mock.calls[0] as [string, string[]];
      expect(sql).toContain('deletado_em IS NOT NULL');
      expect(sql).toContain('deletado_em <');
      expect(parametros).toEqual([String(DIAS_ATE_EXPURGO)]);
    });

    it('devolve os ids encontrados', async () => {
      const query = jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

      await expect(listarContasVencidas({ query } as never)).resolves.toEqual([
        'a',
        'b',
      ]);
    });
  });
});
