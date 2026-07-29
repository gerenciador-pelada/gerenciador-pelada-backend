import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemporadaEntity } from '../../banco/entidades/temporada.entity';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { TemporadasService } from './temporadas.service';

const DONO = 'usuario-1';
const PERIODO = { dataInicio: '2026-01-01', dataFim: '2026-12-31' };

describe('TemporadasService', () => {
  let servico: TemporadasService;
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
        TemporadasService,
        { provide: getRepositoryToken(TemporadaEntity), useValue: repositorio },
      ],
    }).compile();
    servico = modulo.get(TemporadasService);
  });

  it('recusa periodo com fim anterior ao inicio', async () => {
    repositorio.findOne.mockResolvedValue(null);

    await expect(
      servico.criar(DONO, {
        nome: 'Temporada 2026',
        dataInicio: '2026-12-31',
        dataFim: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
  });

  it('recusa nome repetido para o mesmo organizador', async () => {
    repositorio.findOne.mockResolvedValue({ id: 'existente' });

    await expect(
      servico.criar(DONO, { nome: 'Temporada 2026', ...PERIODO }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cria a temporada ativa por padrao', async () => {
    repositorio.findOne.mockResolvedValue(null);
    repositorio.create.mockImplementation((d: Partial<TemporadaEntity>) => d);
    repositorio.save.mockImplementation((d: TemporadaEntity) =>
      Promise.resolve({ ...d, id: 'nova' }),
    );

    await servico.criar(DONO, { nome: 'Temporada 2026', ...PERIODO });

    expect(repositorio.create).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: DONO, ativa: true }),
    );
  });

  it('nao encontra temporada de outro organizador', async () => {
    repositorio.findOne.mockResolvedValue(null);

    await expect(
      servico.buscarPorId('usuario-2', 'temporada-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
