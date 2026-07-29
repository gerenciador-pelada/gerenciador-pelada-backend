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

export function lerConfiguracaoJwt(): ConfiguracaoJwt {
  return {
    segredo: obrigatorio('JWT_SEGREDO'),
    expiracao: process.env.JWT_EXPIRACAO ?? '7d',
  };
}
