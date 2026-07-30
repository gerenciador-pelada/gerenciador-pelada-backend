import { criarOpcoesBanco } from './banco.module';

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
});
