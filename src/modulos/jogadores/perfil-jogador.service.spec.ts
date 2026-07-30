import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { PerfilJogadorService } from './perfil-jogador.service';

function criarConstrutor() {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };
}

describe('PerfilJogadorService', () => {
  it('soma gol contra nas bolas murchas sem contar como gol marcado', async () => {
    const totais = criarConstrutor();
    totais.getRawOne.mockResolvedValue({
      partidas: '2',
      pontuacao: '5',
      peladas: '1',
    });
    const contagens = criarConstrutor();
    contagens.getRawMany.mockResolvedValue([
      { tipo: TipoEventoPartida.BOLA_MURCHA, total: '2' },
      { tipo: TipoEventoPartida.GOL_CONTRA, total: '1' },
    ]);
    const assistencias = criarConstrutor();
    assistencias.getRawOne.mockResolvedValue({ total: '0' });
    let consultaEvento = 0;
    const servico = new PerfilJogadorService(
      {
        findOne: jest.fn().mockResolvedValue({
          id: 'jogador-1',
          nome: 'Ana',
          apelido: null,
          posicaoPreferida: 'LINHA',
          podeSerGoleiro: false,
        }),
      } as never,
      { createQueryBuilder: () => totais } as never,
      {
        createQueryBuilder: () => {
          consultaEvento += 1;
          return consultaEvento === 1 ? contagens : assistencias;
        },
      } as never,
    );

    const perfil = await servico.montar('usuario-1', 'jogador-1');

    expect(perfil.gols).toBe(0);
    expect(perfil.bolasMurchas).toBe(3);
  });
});
