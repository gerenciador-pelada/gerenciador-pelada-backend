/**
 * Estado local da assinatura.
 *
 * Nao repete os status do Asaas um a um: o que o app precisa saber e se pode
 * usar, se precisa pagar, ou se acabou. Traduzir na borda evita espalhar
 * vocabulario de gateway pelo domínio — e evita quebrar tudo se o Asaas criar
 * um status novo amanha.
 */
export enum StatusAssinatura {
  /** Cobranca em dia. */
  ATIVA = 'ATIVA',
  /** Existe, mas a cobranca do ciclo nao foi paga. */
  VENCIDA = 'VENCIDA',
  /** Encerrada pelo organizador ou pelo Asaas. */
  CANCELADA = 'CANCELADA',
}
