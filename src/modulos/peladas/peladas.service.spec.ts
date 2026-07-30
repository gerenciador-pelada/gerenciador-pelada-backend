import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GrupoPeladaEntity } from '../../banco/entidades/grupo-pelada.entity';
import { LocalPeladaEntity } from '../../banco/entidades/local-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { TemporadaEntity } from '../../banco/entidades/temporada.entity';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { PeladasService } from './peladas.service';

const DONO = 'usuario-1';
const OUTRO = 'usuario-2';
const LOCAL = '11111111-1111-4111-8111-111111111111';
const GRUPO = '44444444-4444-4444-8444-444444444444';

describe('PeladasService', () => {
  let servico: PeladasService;
  const peladas = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const grupos = { findOne: jest.fn() };
  const locais = { findOne: jest.fn() };
  const temporadas = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    grupos.findOne.mockResolvedValue({
      id: GRUPO,
      organizadorId: DONO,
      nome: 'Pelada de quarta',
    });
    const modulo = await Test.createTestingModule({
      providers: [
        PeladasService,
        { provide: getRepositoryToken(PeladaEntity), useValue: peladas },
        { provide: getRepositoryToken(GrupoPeladaEntity), useValue: grupos },
        { provide: getRepositoryToken(LocalPeladaEntity), useValue: locais },
        { provide: getRepositoryToken(TemporadaEntity), useValue: temporadas },
      ],
    }).compile();
    servico = modulo.get(PeladasService);
  });

  const dtoValido = {
    grupoId: GRUPO,
    dataHora: '2026-08-05T19:30:00-03:00',
    localId: LOCAL,
  };

  describe('criar', () => {
    it('recusa grupo que nao pertence ao organizador', async () => {
      grupos.findOne.mockResolvedValue(null);
      locais.findOne.mockResolvedValue({ id: LOCAL, usuarioId: DONO });

      await expect(servico.criar(DONO, dtoValido)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(grupos.findOne).toHaveBeenCalledWith({
        where: { id: GRUPO, organizadorId: DONO },
      });
      expect(peladas.save).not.toHaveBeenCalled();
    });

    it('recusa local que nao pertence ao organizador', async () => {
      locais.findOne.mockResolvedValue(null);

      await expect(servico.criar(DONO, dtoValido)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(peladas.save).not.toHaveBeenCalled();
    });

    it('cria a pelada aberta para inscricoes, com configuracao padrao junto', async () => {
      locais.findOne.mockResolvedValue({ id: LOCAL, usuarioId: DONO });
      peladas.create.mockImplementation((d: Partial<PeladaEntity>) => d);
      peladas.save.mockImplementation((d: PeladaEntity) =>
        Promise.resolve({ ...d, id: 'pelada-1' }),
      );

      const criada = await servico.criar(DONO, dtoValido);

      const salva = peladas.create.mock.calls[0][0] as PeladaEntity;
      expect(salva.organizadorId).toBe(DONO);
      expect(salva.grupoId).toBe(GRUPO);
      expect(salva.nome).toBe('Pelada de quarta');
      expect(salva.status).toBe(StatusPelada.ABERTA_INSCRICOES);
      expect(salva.configuracao).toBeDefined();
      expect(criada.id).toBe('pelada-1');
    });

    it('recusa temporada que nao pertence ao organizador', async () => {
      locais.findOne.mockResolvedValue({ id: LOCAL, usuarioId: DONO });
      temporadas.findOne.mockResolvedValue(null);

      await expect(
        servico.criar(DONO, {
          ...dtoValido,
          temporadaId: '22222222-2222-4222-8222-222222222222',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('buscarPorId', () => {
    it('nao encontra pelada de outro organizador', async () => {
      peladas.findOne.mockResolvedValue(null);

      await expect(
        servico.buscarPorId(OUTRO, 'pelada-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(peladas.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pelada-1', organizadorId: OUTRO },
        }),
      );
    });

    it('carrega a configuracao junto', async () => {
      peladas.findOne.mockResolvedValue({ id: 'pelada-1' });

      await servico.buscarPorId(DONO, 'pelada-1');

      expect(peladas.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['configuracao', 'grupo']),
        }),
      );
    });
  });

  describe('alterarStatus', () => {
    it('recusa finalizar pelo atalho generico de status', async () => {
      peladas.findOne.mockResolvedValue({
        id: 'pelada-1',
        status: StatusPelada.EM_ANDAMENTO,
      });

      await expect(
        servico.alterarStatus(DONO, 'pelada-1', StatusPelada.FINALIZADA),
      ).rejects.toMatchObject<Partial<ErroRegraPelada>>({
        codigo: 'FINALIZACAO_EXIGE_OPERACAO_DEDICADA',
      });
      expect(peladas.save).not.toHaveBeenCalled();
    });

    it('recusa transicao invalida com ErroRegraPelada', async () => {
      peladas.findOne.mockResolvedValue({
        id: 'pelada-1',
        status: StatusPelada.FINALIZADA,
      });

      await expect(
        servico.alterarStatus(DONO, 'pelada-1', StatusPelada.EM_ANDAMENTO),
      ).rejects.toBeInstanceOf(ErroRegraPelada);
      expect(peladas.save).not.toHaveBeenCalled();
    });

    it('aplica transicao valida', async () => {
      const pelada = {
        id: 'pelada-1',
        status: StatusPelada.ABERTA_INSCRICOES,
      } as PeladaEntity;
      peladas.findOne.mockResolvedValue(pelada);
      peladas.save.mockImplementation((d: PeladaEntity) => Promise.resolve(d));

      const atualizada = await servico.alterarStatus(
        DONO,
        'pelada-1',
        StatusPelada.EM_ANDAMENTO,
      );

      expect(atualizada.status).toBe(StatusPelada.EM_ANDAMENTO);
    });
  });

  describe('atualizar', () => {
    it('atualiza data e local sem alterar o nome herdado do grupo', async () => {
      const novoLocal = '33333333-3333-4333-8333-333333333333';
      const pelada = {
        id: 'pelada-1',
        organizadorId: DONO,
        localId: LOCAL,
        temporadaId: null,
        nome: 'Pelada antiga',
        dataHora: new Date('2026-08-05T19:30:00-03:00'),
      } as PeladaEntity;
      peladas.findOne.mockResolvedValue(pelada);
      locais.findOne.mockResolvedValue({ id: novoLocal, usuarioId: DONO });
      peladas.save.mockImplementation((d: PeladaEntity) => Promise.resolve(d));

      const atualizada = await servico.atualizar(DONO, 'pelada-1', {
        dataHora: '2026-08-12T20:00:00-03:00',
        localId: novoLocal,
      });

      expect(locais.findOne).toHaveBeenCalledWith({
        where: { id: novoLocal, usuarioId: DONO },
      });
      expect(atualizada.nome).toBe('Pelada antiga');
      expect(atualizada.localId).toBe(novoLocal);
      expect(atualizada.dataHora).toEqual(
        new Date('2026-08-12T20:00:00-03:00'),
      );
      expect(peladas.save).toHaveBeenCalledWith(pelada);
    });
  });

  describe('remover', () => {
    it('remove a pelada de forma logica', async () => {
      const pelada = { id: 'pelada-1', organizadorId: DONO } as PeladaEntity;
      peladas.findOne.mockResolvedValue(pelada);

      await servico.remover(DONO, 'pelada-1');

      expect(peladas.softRemove).toHaveBeenCalledWith(pelada);
    });
  });

  describe('listar', () => {
    it('filtra por organizador, status e periodo', async () => {
      const construtor = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'p1' }], 1]),
      };
      peladas.createQueryBuilder.mockReturnValue(construtor);

      const resultado = await servico.listar(DONO, {
        status: StatusPelada.EM_ANDAMENTO,
        dataInicio: '2026-08-01',
        dataFim: '2026-08-31',
        pagina: 1,
        limite: 20,
        pular: 0,
      });

      expect(construtor.where).toHaveBeenCalledWith(
        expect.stringContaining('organizadorId'),
        expect.objectContaining({ organizadorId: DONO }),
      );
      expect(resultado.paginacao.total).toBe(1);
    });
  });
});
