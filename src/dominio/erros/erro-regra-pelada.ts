/**
 * Erro lancado pela camada de dominio quando uma regra da pelada e violada.
 * Nao depende do NestJS: o dominio nao conhece o framework.
 * O filtro global traduz este erro para HTTP 422.
 */
export class ErroRegraPelada extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
    readonly detalhes?: Record<string, unknown>,
  ) {
    super(mensagem);
    this.name = 'ErroRegraPelada';
  }
}
