import type { CicloAssinatura } from './cliente-asaas';

export type CodigoPlano = 'MENSAL' | 'ANUAL';

export interface Plano {
  codigo: CodigoPlano;
  rotulo: string;
  ciclo: CicloAssinatura;
  valorCentavos: number;
}

/**
 * Preco tabelado, definido AQUI e nunca pelo cliente.
 *
 * A primeira versao recebia `valorCentavos` no corpo da requisicao — quem
 * soubesse mandar um POST assinava por um real. Preco e decisao do produto, e
 * o servidor e o unico lugar onde ela pode morar.
 *
 * Trocar de valor aqui nao mexe em quem ja assinou: a assinatura no Asaas
 * guarda o valor com que foi criada, e so muda se for atualizada la.
 */
export const PLANOS: Record<CodigoPlano, Plano> = {
  MENSAL: {
    codigo: 'MENSAL',
    rotulo: 'Mensal',
    ciclo: 'MONTHLY',
    valorCentavos: 1990,
  },
  ANUAL: {
    codigo: 'ANUAL',
    rotulo: 'Anual',
    ciclo: 'YEARLY',
    valorCentavos: 19900,
  },
};

export const listarPlanos = (): Plano[] => Object.values(PLANOS);
