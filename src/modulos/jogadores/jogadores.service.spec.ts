import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { JogadoresService } from './jogadores.service';

const DONO = 'usuario-1';
const OUTRO = 'usuario-2';

describe('JogadoresService', () => {
  let servico: JogadoresService;
  const repositorio = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        JogadoresService,
        { provide: getRepositoryToken(JogadorEntity), useValue: repositorio },
      ],
    }).compile();
    servico = modulo.get(JogadoresService);
  });

  it('recusa jogador com nome ja usado pelo mesmo organizador', async () => {
    repositorio.findOne.mockResolvedValue({ id: 'existente' });

    await expect(servico.criar(DONO, { nome: 'Lucas' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('cria o jogador vinculado ao usuario autenticado', async () => {
    repositorio.findOne.mockResolvedValue(null);
    repositorio.create.mockImplementation((d: Partial<JogadorEntity>) => d);
    repositorio.save.mockImplementation((d: JogadorEntity) =>
      Promise.resolve({ ...d, id: 'novo' }),
    );

    const criado = await servico.criar(DONO, {
      nome: '  Lucas  ',
      podeSerGoleiro: true,
    });

    expect(repositorio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: DONO,
        nome: 'Lucas',
        podeSerGoleiro: true,
      }),
    );
    expect(criado.id).toBe('novo');
  });

  it('nao encontra jogador de outro organizador', async () => {
    repositorio.findOne.mockResolvedValue(null);

    await expect(
      servico.buscarPorId(OUTRO, 'jogador-do-dono'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorio.findOne).toHaveBeenCalledWith({
      where: { id: 'jogador-do-dono', usuarioId: OUTRO },
    });
  });

  it('remove logicamente, preservando o registro', async () => {
    const jogador = { id: 'j1', usuarioId: DONO } as JogadorEntity;
    repositorio.findOne.mockResolvedValue(jogador);

    await servico.remover(DONO, 'j1');

    expect(repositorio.softRemove).toHaveBeenCalledWith(jogador);
  });

  it('lista paginado aplicando o filtro de busca', async () => {
    const construtor = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'j1' }], 1]),
    };
    repositorio.createQueryBuilder.mockReturnValue(construtor);

    const resultado = await servico.listar(DONO, {
      busca: 'luc',
      pagina: 1,
      limite: 20,
      pular: 0,
    });

    expect(construtor.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      expect.objectContaining({ busca: '%luc%' }),
    );
    expect(resultado.paginacao.total).toBe(1);
    expect(resultado.itens).toHaveLength(1);
  });
});
