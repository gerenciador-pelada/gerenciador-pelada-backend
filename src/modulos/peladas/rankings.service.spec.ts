import { NotFoundException } from '@nestjs/common';
import { AcessoPeladaService } from './acesso-pelada.service';
import { RankingsService } from './rankings.service';

const DONO = 'usuario-1';
const INTRUSO = 'usuario-2';

function criarConstrutor() {
  const construtor = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
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
    const construtor = criarConstrutor();
    const servico = new RankingsService(
      { createQueryBuilder: () => construtor } as never,
      criarAcesso(true),
    );

    await servico.listar(DONO);

    expect(construtor.innerJoin).toHaveBeenCalledWith(
      expect.anything(),
      'pelada',
      'pelada.id = p.peladaId',
    );
    expect(construtor.where).toHaveBeenCalledWith(
      'pelada.organizadorId = :usuarioId',
      { usuarioId: DONO },
    );
  });

  it('recusa ranking de pelada de outro organizador', async () => {
    const construtor = criarConstrutor();
    const servico = new RankingsService(
      { createQueryBuilder: () => construtor } as never,
      criarAcesso(false),
    );

    await expect(servico.listar(INTRUSO, 'pelada-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(construtor.getRawMany).not.toHaveBeenCalled();
  });

  it('filtra por pelada quando o id e informado', async () => {
    const construtor = criarConstrutor();
    const servico = new RankingsService(
      { createQueryBuilder: () => construtor } as never,
      criarAcesso(true),
    );

    await servico.listar(DONO, 'pelada-1');

    expect(construtor.andWhere).toHaveBeenCalledWith('p.peladaId = :peladaId', {
      peladaId: 'pelada-1',
    });
  });
});
