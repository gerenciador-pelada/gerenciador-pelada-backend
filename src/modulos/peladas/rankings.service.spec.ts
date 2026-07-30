import { NotFoundException } from '@nestjs/common';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { AcessoPeladaService } from './acesso-pelada.service';
import { RankingsService } from './rankings.service';

const DONO = 'usuario-1';
const INTRUSO = 'usuario-2';

function criarConstrutor(resultado: unknown[]) {
  const construtor = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(resultado),
  };
  return construtor;
}

function criarAcesso(peladaEhDoUsuario: boolean): AcessoPeladaService {
  return {
    garantirPelada: jest
      .fn()
      .mockImplementation(() =>
        peladaEhDoUsuario
          ? Promise.resolve()
          : Promise.reject(new NotFoundException('Pelada nao encontrada')),
      ),
  } as unknown as AcessoPeladaService;
}

describe('RankingsService', () => {
  it('restringe a agregacao as peladas do organizador', async () => {
    const pontuacao = criarConstrutor([]);
    const servico = new RankingsService(
      { createQueryBuilder: () => pontuacao } as never,
      { createQueryBuilder: () => criarConstrutor([]) } as never,
      criarAcesso(true),
    );

    await servico.listar(DONO);

    expect(pontuacao.where).toHaveBeenCalledWith(
      'pelada.organizadorId = :usuarioId',
      { usuarioId: DONO },
    );
  });

  it('recusa ranking de pelada de outro organizador', async () => {
    const pontuacao = criarConstrutor([]);
    const servico = new RankingsService(
      { createQueryBuilder: () => pontuacao } as never,
      { createQueryBuilder: () => criarConstrutor([]) } as never,
      criarAcesso(false),
    );

    await expect(servico.listar(INTRUSO, 'pelada-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(pontuacao.getRawMany).not.toHaveBeenCalled();
  });

  it('conta gols pelos eventos, nao pela pontuacao', async () => {
    // Pelada que nao pontua gol: pontosGol = 0, entao a pontuacao nada diz
    // sobre quantos gols o jogador fez. A contagem precisa vir dos eventos.
    const pontuacao = criarConstrutor([
      {
        jogadorId: 'j1',
        nome: 'Ronaldo',
        apelido: null,
        pontuacao: '3',
        partidas: '1',
      },
    ]);
    let chamada = 0;
    const eventos = {
      createQueryBuilder: () => {
        chamada += 1;
        return chamada === 1
          ? criarConstrutor([
              {
                jogadorId: 'j1',
                tipo: TipoEventoPartida.GOL,
                total: '2',
              },
              {
                jogadorId: 'j1',
                tipo: TipoEventoPartida.BOLA_CHEIA,
                total: '1',
              },
              {
                jogadorId: 'j1',
                tipo: TipoEventoPartida.GOL_CONTRA,
                total: '1',
              },
            ])
          : criarConstrutor([{ jogadorId: 'j1', total: '4' }]);
      },
    };

    const servico = new RankingsService(
      { createQueryBuilder: () => pontuacao } as never,
      eventos as never,
      criarAcesso(true),
    );

    const [linha] = await servico.listar(DONO);

    expect(linha).toEqual(
      expect.objectContaining({
        nome: 'Ronaldo',
        pontuacao: 3,
        partidas: 1,
        gols: 2,
        assistencias: 4,
        bolasCheias: 1,
        bolasMurchas: 1,
      }),
    );
  });

  it('devolve lista vazia sem consultar eventos quando ninguem pontuou', async () => {
    const eventos = { createQueryBuilder: jest.fn() };
    const servico = new RankingsService(
      { createQueryBuilder: () => criarConstrutor([]) } as never,
      eventos as never,
      criarAcesso(true),
    );

    await expect(servico.listar(DONO)).resolves.toEqual([]);
    expect(eventos.createQueryBuilder).not.toHaveBeenCalled();
  });
});
