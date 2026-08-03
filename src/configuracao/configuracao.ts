export interface ConfiguracaoApp {
  porta: number;
  prefixo: string;
}

export interface ConfiguracaoBanco {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  nome: string;
}

export interface ConfiguracaoJwt {
  segredo: string;
  expiracao: string;
}

function obrigatorio(chave: string): string {
  const valor = process.env[chave];
  if (!valor) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${chave}`);
  }
  return valor;
}

export function lerConfiguracaoApp(): ConfiguracaoApp {
  return {
    porta: Number(process.env.APP_PORTA ?? 3001),
    prefixo: process.env.APP_PREFIXO ?? 'api',
  };
}

export function lerConfiguracaoBanco(): ConfiguracaoBanco {
  return {
    host: obrigatorio('BANCO_HOST'),
    porta: Number(obrigatorio('BANCO_PORTA')),
    usuario: obrigatorio('BANCO_USUARIO'),
    senha: obrigatorio('BANCO_SENHA'),
    nome: obrigatorio('BANCO_NOME'),
  };
}

/**
 * Segredos que ja vazaram: sao os valores de exemplo que acompanham o repo.
 * Quem clonar o projeto e subir sem trocar assina tokens com uma chave publica,
 * e qualquer pessoa forja um token de organizador. Melhor nao subir.
 */
const SEGREDOS_PROIBIDOS = new Set([
  'troque-este-segredo-em-producao',
  'segredo-de-teste',
  'secret',
  'changeme',
]);

export function lerConfiguracaoJwt(): ConfiguracaoJwt {
  const segredo = obrigatorio('JWT_SEGREDO');

  // O ambiente de teste usa segredo fixo de proposito, e nunca atende a rede.
  if (process.env.NODE_ENV !== 'test') {
    if (SEGREDOS_PROIBIDOS.has(segredo) || segredo.length < 32) {
      throw new Error(
        'JWT_SEGREDO inseguro. Gere um novo com:\n' +
          "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
      );
    }
  }

  return { segredo, expiracao: process.env.JWT_EXPIRACAO ?? '7d' };
}

/**
 * Origens que o navegador pode usar para chamar a API.
 *
 * Sem isso o CORS refletia qualquer origem, entao qualquer site aberto numa
 * aba vizinha podia disparar requisicoes autenticadas contra a API. Lista
 * vazia significa "so o proprio servidor", nao "todo mundo".
 */
export function lerOrigensPermitidas(): string[] {
  return (process.env.CORS_ORIGENS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/**
 * Codigo que libera a criacao de conta.
 *
 * O cadastro cria um ORGANIZADOR com poderes totais sobre as proprias peladas.
 * Deixar aberto num endereco publico e convidar estranhos a criar conta. Sem
 * codigo configurado o cadastro fica fechado — negar por padrao.
 */
export function lerConviteCadastro(): string | null {
  const convite = process.env.CADASTRO_CONVITE?.trim();
  return convite && convite.length > 0 ? convite : null;
}

export interface ConfiguracaoAsaas {
  chave: string;
  /** URL base ja resolvida pelo ambiente. */
  base: string;
  producao: boolean;
  /** Segredo que o Asaas devolve no cabecalho de cada webhook. */
  tokenWebhook: string;
}

const BASE_SANDBOX = 'https://api-sandbox.asaas.com/v3';
const BASE_PRODUCAO = 'https://api.asaas.com/v3';

/**
 * Credenciais do Asaas.
 *
 * Devolve `null` quando nao ha chave: o modulo de assinatura fica desligado e o
 * resto do app sobe normal. E de proposito — ninguem deve ficar sem gerenciar a
 * pelada porque a integracao de cobranca nao foi configurada.
 *
 * O que NAO e opcional: se ha chave, tem que haver token de webhook. Sem ele o
 * endpoint de webhook aceitaria qualquer POST da internet dizendo "pagamento
 * confirmado", e liberar assinatura de graca e pior do que nao cobrar.
 *
 * A chave de producao comeca com `$aact_prod_`; a de sandbox, com `$aact_hmlg_`
 * ou `$aact_YTU5`. Conferir o prefixo evita o erro caro na direcao perigosa —
 * cobrar de gente de verdade achando que esta em teste.
 */
export function lerConfiguracaoAsaas(): ConfiguracaoAsaas | null {
  const chave = process.env.ASAAS_CHAVE?.trim();
  if (!chave) return null;

  const producao = (process.env.ASAAS_AMBIENTE ?? 'sandbox').trim() === 'producao';

  if (producao && !chave.startsWith('$aact_prod_'))
    throw new Error(
      'ASAAS_AMBIENTE=producao mas a chave nao parece de producao. ' +
        'Conferir antes de cobrar de gente de verdade.',
    );
  if (!producao && chave.startsWith('$aact_prod_'))
    throw new Error(
      'Chave de PRODUCAO com ASAAS_AMBIENTE=sandbox. Isso cobraria de verdade ' +
        'durante os testes: use a chave de sandbox.',
    );

  const tokenWebhook = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!tokenWebhook || tokenWebhook.length < 16)
    throw new Error(
      'ASAAS_WEBHOOK_TOKEN ausente ou curto demais. Sem ele qualquer POST na ' +
        'internet libera assinatura. Gere um com:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );

  return {
    chave,
    base: producao ? BASE_PRODUCAO : BASE_SANDBOX,
    producao,
    tokenWebhook,
  };
}
