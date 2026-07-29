export interface RegrasPontuacao {
  pontosVitoria: number;
  pontosEmpate: number;
  pontosDerrota: number;
  pontosGol: number;
  pontosAssistencia: number;
  pontosBolaCheia: number;
  pontosBolaMurcha: number;
}
export interface EventosPontuacao {
  gols: number;
  assistencias: number;
  bolasCheias: number;
  bolasMurchas: number;
  resultado: 'VITORIA' | 'EMPATE' | 'DERROTA';
}
export class CalculadoraPontuacao {
  static calcular(regras: RegrasPontuacao, eventos: EventosPontuacao) {
    const pontosResultado =
      eventos.resultado === 'VITORIA'
        ? regras.pontosVitoria
        : eventos.resultado === 'EMPATE'
          ? regras.pontosEmpate
          : regras.pontosDerrota;
    const pontosGols = eventos.gols * regras.pontosGol;
    const pontosAssistencias = eventos.assistencias * regras.pontosAssistencia;
    const pontosBolaCheia = eventos.bolasCheias * regras.pontosBolaCheia;
    const pontosBolaMurcha = eventos.bolasMurchas * regras.pontosBolaMurcha;
    return {
      pontosResultado,
      pontosGols,
      pontosAssistencias,
      pontosBolaCheia,
      pontosBolaMurcha,
      pontosTotal:
        pontosResultado +
        pontosGols +
        pontosAssistencias +
        pontosBolaCheia +
        pontosBolaMurcha,
    };
  }
}
