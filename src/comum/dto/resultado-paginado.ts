export interface Paginacao {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export class ResultadoPaginado<T> {
  constructor(
    readonly itens: T[],
    readonly paginacao: Paginacao,
  ) {}

  static criar<T>(itens: T[], total: number, pagina: number, limite: number) {
    return new ResultadoPaginado<T>(itens, {
      pagina,
      limite,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    });
  }
}
