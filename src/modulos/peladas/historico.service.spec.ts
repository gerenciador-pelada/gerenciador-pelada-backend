import { NotFoundException } from '@nestjs/common';
import { AcessoPeladaService } from './acesso-pelada.service';
import { HistoricoService } from './historico.service';

const DONO = 'usuario-1';
const INTRUSO = 'usuario-2';

function criarAcesso(peladaEhDoUsuario: boolean): AcessoPeladaService {
  return {
    garantirPelada: jest.fn().mockImplementation(() => {
      if (!peladaEhDoUsuario) {
        return Promise.reject(new NotFoundException('Pelada nao encontrada'));
      }
      return Promise.resolve();
    }),
  } as unknown as AcessoPeladaService;
}

describe('HistoricoService', () => {
  function criarRepositorio() {
    return {
      findOne: jest
        .fn()
        .mockResolvedValue({ snapshotEstado: { fila: [] }, desfeitaEm: null }),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
    };
  }

  it('marca a ultima acao como desfeita', async () => {
    const repositorio = criarRepositorio();
    const servico = new HistoricoService(
      repositorio as never,
      criarAcesso(true),
    );

    await expect(servico.desfazer(DONO, 'p')).resolves.toEqual({ fila: [] });
    expect(repositorio.save).toHaveBeenCalled();
  });

  it('recusa desfazer acao de pelada de outro organizador', async () => {
    const repositorio = criarRepositorio();
    const servico = new HistoricoService(
      repositorio as never,
      criarAcesso(false),
    );

    await expect(servico.desfazer(INTRUSO, 'p')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repositorio.findOne).not.toHaveBeenCalled();
    expect(repositorio.save).not.toHaveBeenCalled();
  });

  it('recusa listar historico de pelada de outro organizador', async () => {
    const repositorio = criarRepositorio();
    const servico = new HistoricoService(
      repositorio as never,
      criarAcesso(false),
    );

    await expect(servico.listar(INTRUSO, 'p')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repositorio.find).not.toHaveBeenCalled();
  });
});
