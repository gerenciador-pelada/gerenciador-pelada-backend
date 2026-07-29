import { CalculadoraPontuacao } from './calculadora-pontuacao';
it('calcula cada origem da pontuacao', () =>
  expect(
    CalculadoraPontuacao.calcular(
      {
        pontosVitoria: 3,
        pontosEmpate: 1,
        pontosDerrota: 0,
        pontosGol: 2,
        pontosAssistencia: 1,
        pontosBolaCheia: 1,
        pontosBolaMurcha: -1,
      },
      {
        resultado: 'VITORIA',
        gols: 2,
        assistencias: 1,
        bolasCheias: 1,
        bolasMurchas: 1,
      },
    ).pontosTotal,
  ).toBe(8));
