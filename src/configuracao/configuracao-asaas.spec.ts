import { lerConfiguracaoAsaas } from './configuracao';

const TOKEN = 'um-token-de-webhook-bem-longo';

describe('lerConfiguracaoAsaas', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  function ambiente(vars: Record<string, string | undefined>) {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  it('desliga o modulo quando nao ha chave', () => {
    ambiente({ ASAAS_CHAVE: undefined });
    // Sem chave o app inteiro tem que subir normal: ninguem deve ficar sem
    // gerenciar a pelada porque a cobranca nao foi configurada.
    expect(lerConfiguracaoAsaas()).toBeNull();
  });

  it('aponta para o sandbox por padrao', () => {
    ambiente({
      ASAAS_CHAVE: '$aact_hmlg_abc',
      ASAAS_AMBIENTE: undefined,
      ASAAS_WEBHOOK_TOKEN: TOKEN,
    });

    const c = lerConfiguracaoAsaas();
    expect(c?.producao).toBe(false);
    expect(c?.base).toContain('sandbox');
  });

  it('recusa chave de producao em ambiente de sandbox', () => {
    // O erro caro na direcao perigosa: cobrar de gente de verdade durante os
    // testes. Falha na subida, nao na primeira cobranca.
    ambiente({
      ASAAS_CHAVE: '$aact_prod_abc',
      ASAAS_AMBIENTE: 'sandbox',
      ASAAS_WEBHOOK_TOKEN: TOKEN,
    });

    expect(() => lerConfiguracaoAsaas()).toThrow(/cobraria de verdade/i);
  });

  it('recusa producao declarada com chave que nao e de producao', () => {
    ambiente({
      ASAAS_CHAVE: '$aact_hmlg_abc',
      ASAAS_AMBIENTE: 'producao',
      ASAAS_WEBHOOK_TOKEN: TOKEN,
    });

    expect(() => lerConfiguracaoAsaas()).toThrow(/nao parece de producao/i);
  });

  it('exige token de webhook junto com a chave', () => {
    // Sem token, qualquer POST na internet diz "pagamento confirmado".
    ambiente({
      ASAAS_CHAVE: '$aact_hmlg_abc',
      ASAAS_AMBIENTE: 'sandbox',
      ASAAS_WEBHOOK_TOKEN: undefined,
    });

    expect(() => lerConfiguracaoAsaas()).toThrow(/ASAAS_WEBHOOK_TOKEN/);
  });

  it('recusa token de webhook curto demais', () => {
    ambiente({
      ASAAS_CHAVE: '$aact_hmlg_abc',
      ASAAS_AMBIENTE: 'sandbox',
      ASAAS_WEBHOOK_TOKEN: 'curto',
    });

    expect(() => lerConfiguracaoAsaas()).toThrow(/ASAAS_WEBHOOK_TOKEN/);
  });
});
