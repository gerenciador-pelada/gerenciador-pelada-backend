import { criarOpcoesBanco } from './banco.module';
import { AdicionarGoleirosAvulsosPartida1785427000000 } from './migracoes/1785427000000-AdicionarGoleirosAvulsosPartida';

const ambienteBanco = {
  BANCO_HOST: 'localhost',
  BANCO_PORTA: '5432',
  BANCO_USUARIO: 'pelada',
  BANCO_SENHA: 'pelada',
  BANCO_NOME: 'gerenciador_pelada',
};

describe('criarOpcoesBanco', () => {
  const ambienteOriginal = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const [chave, valor] of Object.entries(ambienteBanco)) {
      ambienteOriginal.set(chave, process.env[chave]);
      process.env[chave] = valor;
    }
  });

  afterAll(() => {
    for (const [chave, valor] of ambienteOriginal) {
      if (valor === undefined) {
        delete process.env[chave];
      } else {
        process.env[chave] = valor;
      }
    }
  });

  it('executa migrations no bootstrap sem sincronizar o schema', () => {
    const opcoes = criarOpcoesBanco();

    expect(opcoes.migrationsRun).toBe(true);
    expect(opcoes.synchronize).toBe(false);
  });

  it('empacota todas as migrations como dependencias estaticas', () => {
    const migracoes = criarOpcoesBanco().migrations;

    expect(Array.isArray(migracoes)).toBe(true);
    if (!Array.isArray(migracoes)) {
      throw new Error('A configuracao de migrations deve ser uma lista');
    }

    expect(migracoes).toHaveLength(18);
    expect(migracoes).toContain(AdicionarGoleirosAvulsosPartida1785427000000);
    expect(migracoes.every((migracao) => typeof migracao === 'function')).toBe(
      true,
    );
  });
});
