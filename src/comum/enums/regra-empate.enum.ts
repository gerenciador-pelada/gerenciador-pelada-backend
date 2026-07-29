export enum RegraEmpate {
  /** Os dois times saem e dois novos entram. */
  AMBOS_SAEM = 'AMBOS_SAEM',
  /** Sai quem esta em campo ha mais partidas consecutivas. */
  MAIS_TEMPO_EM_CAMPO_SAI = 'MAIS_TEMPO_EM_CAMPO_SAI',
  /** Penaltis ou gol de ouro: o organizador informa o vencedor da decisao. */
  DECISAO_IMEDIATA = 'DECISAO_IMEDIATA',
}
