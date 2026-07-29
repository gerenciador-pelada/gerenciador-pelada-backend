import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LocalPeladaEntity } from '../../banco/entidades/local-pelada.entity';
import { LocaisService } from './locais.service';

const DONO = 'usuario-1';

describe('LocaisService', () => {
  let servico: LocaisService;
  const repositorio = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        LocaisService,
        {
          provide: getRepositoryToken(LocalPeladaEntity),
          useValue: repositorio,
        },
      ],
    }).compile();
    servico = modulo.get(LocaisService);
  });

  it('recusa local com nome repetido para o mesmo organizador', async () => {
    repositorio.findOne.mockResolvedValue({ id: 'existente' });

    await expect(
      servico.criar(DONO, { nome: 'Quadra' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cria o local vinculado ao organizador', async () => {
    repositorio.findOne.mockResolvedValue(null);
    repositorio.create.mockImplementation((d: Partial<LocalPeladaEntity>) => d);
    repositorio.save.mockImplementation((d: LocalPeladaEntity) =>
      Promise.resolve({ ...d, id: 'novo' }),
    );

    const criado = await servico.criar(DONO, {
      nome: ' Quadra ',
      endereco: 'Rua 1',
    });

    expect(repositorio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: DONO,
        nome: 'Quadra',
        endereco: 'Rua 1',
      }),
    );
    expect(criado.id).toBe('novo');
  });

  it('nao encontra local de outro organizador', async () => {
    repositorio.findOne.mockResolvedValue(null);

    await expect(
      servico.buscarPorId('usuario-2', 'local-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista apenas os locais do organizador, ordenados por nome', async () => {
    repositorio.find.mockResolvedValue([{ id: 'l1' }]);

    await servico.listar(DONO);

    expect(repositorio.find).toHaveBeenCalledWith({
      where: { usuarioId: DONO },
      order: { nome: 'ASC' },
    });
  });
});
