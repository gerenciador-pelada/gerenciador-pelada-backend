import { Injectable, Logger } from '@nestjs/common';
import {
  ConfiguracaoAsaas,
  lerConfiguracaoAsaas,
} from '../../configuracao/configuracao';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';

export interface ClienteAsaasDto {
  name: string;
  email: string;
  /** CPF ou CNPJ so com digitos. O Asaas exige para emitir cobranca. */
  cpfCnpj: string;
}

export type CicloAssinatura = 'MONTHLY' | 'YEARLY';

export interface AssinaturaAsaasDto {
  customer: string;
  /** Em reais, com centavos. A conversao de centavos vive no servico. */
  value: number;
  nextDueDate: string;
  cycle: CicloAssinatura;
  description: string;
  billingType: 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  externalReference: string;
}

export interface CobrancaAsaas {
  id: string;
  status: string;
  dueDate: string;
  value: number;
  /** Pagina hospedada pelo Asaas onde o pagador escolhe Pix, boleto ou cartao. */
  invoiceUrl: string;
}

export interface AssinaturaAsaas {
  id: string;
  status: string;
  nextDueDate: string | null;
  value: number;
  cycle: string;
}

/**
 * Cliente HTTP do Asaas.
 *
 * Fino de proposito: mapeia erro e injeta a chave, e nada mais. Toda regra de
 * assinatura vive no servico — aqui so entra o que muda se o Asaas mudar.
 *
 * A chave nunca entra em log nem em mensagem de erro. Ela vai num cabecalho e
 * fica ali; um `console.log(requisicao)` num dia ruim publicaria a chave de
 * cobranca inteira no log do Vercel.
 */
@Injectable()
export class ClienteAsaas {
  private readonly log = new Logger(ClienteAsaas.name);
  private readonly configuracao: ConfiguracaoAsaas | null;

  constructor() {
    this.configuracao = lerConfiguracaoAsaas();
  }

  /** Falso quando nao ha chave: o modulo responde 503 em vez de quebrar. */
  get habilitado(): boolean {
    return this.configuracao !== null;
  }

  get producao(): boolean {
    return this.configuracao?.producao ?? false;
  }

  get tokenWebhook(): string | null {
    return this.configuracao?.tokenWebhook ?? null;
  }

  async criarCliente(dados: ClienteAsaasDto): Promise<{ id: string }> {
    return this.requisitar<{ id: string }>('POST', '/customers', dados);
  }

  async criarAssinatura(dados: AssinaturaAsaasDto): Promise<AssinaturaAsaas> {
    return this.requisitar<AssinaturaAsaas>('POST', '/subscriptions', dados);
  }

  async buscarAssinatura(id: string): Promise<AssinaturaAsaas> {
    return this.requisitar<AssinaturaAsaas>('GET', `/subscriptions/${id}`);
  }

  /**
   * Cobrancas da assinatura, da mais recente para a mais antiga.
   *
   * E daqui que sai o link de pagamento: a criacao da assinatura nao devolve a
   * primeira cobranca, entao sem esta consulta a tela criaria a assinatura e
   * nao teria onde mandar o organizador pagar.
   */
  async cobrancasDaAssinatura(id: string): Promise<CobrancaAsaas[]> {
    const r = await this.requisitar<{ data?: CobrancaAsaas[] }>(
      'GET',
      `/subscriptions/${id}/payments?limit=10`,
    );
    return r.data ?? [];
  }

  async cancelarAssinatura(id: string): Promise<void> {
    await this.requisitar('DELETE', `/subscriptions/${id}`);
  }

  private async requisitar<T>(
    metodo: string,
    caminho: string,
    corpo?: unknown,
  ): Promise<T> {
    const configuracao = this.configuracao;
    if (!configuracao)
      throw new ErroRegraPelada(
        'ASAAS_NAO_CONFIGURADO',
        'A cobranca nao esta configurada neste servidor',
      );

    let resposta: Response;
    try {
      resposta = await fetch(`${configuracao.base}${caminho}`, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          access_token: configuracao.chave,
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch (falha) {
      // Rede fora nao e culpa do organizador, e a mensagem precisa dizer isso
      // sem vazar host nem chave.
      this.log.error(`Asaas inacessivel em ${metodo} ${caminho}`);
      throw new ErroRegraPelada(
        'ASAAS_INDISPONIVEL',
        'Nao foi possivel falar com o servico de cobranca. Tente de novo.',
        { causa: falha instanceof Error ? falha.message : 'desconhecida' },
      );
    }

    const texto = await resposta.text();
    if (!resposta.ok) {
      // O Asaas devolve { errors: [{ code, description }] }.
      const descricao = this.extrairErro(texto);
      this.log.warn(
        `Asaas respondeu ${resposta.status} em ${metodo} ${caminho}: ${descricao}`,
      );
      throw new ErroRegraPelada('ASAAS_RECUSOU', descricao, {
        status: resposta.status,
      });
    }

    return texto ? (JSON.parse(texto) as T) : ({} as T);
  }

  private extrairErro(texto: string): string {
    try {
      const corpo = JSON.parse(texto) as {
        errors?: { description?: string }[];
      };
      const descricao = corpo.errors?.[0]?.description;
      if (descricao) return descricao;
    } catch {
      // Corpo nao-JSON: cai no texto cru, truncado.
    }
    return texto.slice(0, 200) || 'Erro sem descricao';
  }
}
