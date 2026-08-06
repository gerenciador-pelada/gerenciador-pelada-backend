import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GrupoPeladaEntity } from '../../banco/entidades/grupo-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { GruposPeladaService } from './grupos-pelada.service';

const DONO = '11111111-1111-4111-8111-111111111111';
const OUTRO = '22222222-2222-4222-8222-222222222222';
const GRUPO = '33333333-3333-4333-8333-333333333333';

describe('GruposPeladaService', () => {
  let servico: GruposPeladaService;

  const grupos = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    softRemove: jest.fn(),
  };
  const gerenciador = {
    save: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    softRemove: jest.fn(),
  };
  const fonteDados = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    grupos.create.mockImplementation(
      (dados: Partial<GrupoPeladaEntity>) => dados,
    );
    grupos.save.mockImplementation((grupo: GrupoPeladaEntity) =>
      Promise.resolve({ ...grupo, id: GRUPO }),
    );
    fonteDados.transaction.mockImplementation(
      (operacao: (manager: typeof gerenciador) => unknown) =>
        operacao(gerenciador),
    );
    gerenciador.save.mockImplementation(
      (_entidade: unknown, grupo: GrupoPeladaEntity) => Promise.resolve(grupo),
    );

    const modulo = await Test.createTestingModule({
      providers: [
        GruposPeladaService,
        {
          provide: getRepositoryToken(GrupoPeladaEntity),
          useValue: grupos,
        },
        { provide: DataSource, useValue: fonteDados },
      ],
    }).compile();

    servico = modulo.get(GruposPeladaService);
  });

  it('cria a pelada recorrente com o nome aparado', async () => {
    grupos.findOne.mockResolvedValue(null);

    const criado = await servico.criar(DONO, { nome: '  Pelada de quarta  ' });

    expect(criado).toMatchObject({
      id: GRUPO,
      organizadorId: DONO,
      nome: 'Pelada de quarta',
    });
  });

  it('recusa nome repetido sem diferenciar maiusculas', async () => {
    grupos.findOne.mockResolvedValue({
      id: GRUPO,
      organizadorId: DONO,
      nome: 'Pelada de quarta',
    });

    await expect(
      servico.criar(DONO, { nome: 'PELADA DE QUARTA' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(grupos.save).not.toHaveBeenCalled();
  });

  it('nao revela grupo de outro organizador', async () => {
    grupos.findOne.mockResolvedValue(null);

    await expect(servico.buscarPorId(OUTRO, GRUPO)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resume edicao em andamento, proxima edicao e quantidade total', async () => {
    grupos.find.mockResolvedValue([
      {
        id: GRUPO,
        organizadorId: DONO,
        nome: 'Pelada de quarta',
        edicoes: [
          {
            id: 'edicao-finalizada',
            status: StatusPelada.FINALIZADA,
            dataHora: new Date('2026-07-01T22:00:00Z'),
          },
          {
            id: 'edicao-proxima',
            status: StatusPelada.ABERTA_INSCRICOES,
            dataHora: new Date('2099-08-05T22:00:00Z'),
          },
          {
            id: 'edicao-atual',
            status: StatusPelada.EM_ANDAMENTO,
            dataHora: new Date('2099-07-29T22:00:00Z'),
          },
        ],
      },
    ]);

    const [resumo] = await servico.listar(DONO);

    expect(resumo.quantidadeEdicoes).toBe(3);
    expect(resumo.edicaoEmAndamento?.id).toBe('edicao-atual');
    expect(resumo.proximaEdicao?.id).toBe('edicao-proxima');
    expect(resumo.edicoes.map((edicao) => edicao.id)).toEqual([
      'edicao-proxima',
      'edicao-atual',
      'edicao-finalizada',
    ]);
  });

  it('renomeia o grupo e sincroniza o nome de todas as edicoes', async () => {
    const grupo = {
      id: GRUPO,
      organizadorId: DONO,
      nome: 'Pelada antiga',
      edicoes: [],
    } as unknown as GrupoPeladaEntity;
    grupos.findOne.mockResolvedValueOnce(grupo).mockResolvedValueOnce(null);

    const atualizado = await servico.atualizar(DONO, GRUPO, {
      nome: '  Pelada nova  ',
    });

    expect(atualizado.nome).toBe('Pelada nova');
    expect(gerenciador.update).toHaveBeenCalledWith(
      PeladaEntity,
      { grupoId: GRUPO },
      { nome: 'Pelada nova' },
    );
  });

  // A regra anterior recusava excluir grupo que tivesse qualquer edicao,
  // inclusive ja excluida — o que prendia o grupo para sempre, porque apagar
  // as edicoes antes nao ajudava em nada. Virou cascata, por decisao de
  // produto: um comando so, com confirmacao forte na interface.
  it('leva as edicoes junto ao excluir o grupo, numa transacao', async () => {
    const grupo = {
      id: GRUPO,
      organizadorId: DONO,
      nome: 'Pelada',
      edicoes: [],
    } as unknown as GrupoPeladaEntity;
    const edicoes = [{ id: 'e1' }, { id: 'e2' }];
    grupos.findOne.mockResolvedValue(grupo);
    gerenciador.find.mockResolvedValue(edicoes);

    await servico.remover(DONO, GRUPO);

    expect(gerenciador.find).toHaveBeenCalledWith(PeladaEntity, {
      where: { grupoId: GRUPO },
    });
    expect(gerenciador.softRemove).toHaveBeenCalledWith(edicoes);
    expect(gerenciador.softRemove).toHaveBeenCalledWith(grupo);
  });

  // `softRemove([])` do TypeORM com lista vazia e chamada inutil; pior, em
  // algumas versoes ela reclama. O grupo vazio tem que sair mesmo assim.
  it('exclui grupo sem edicoes sem tentar remover lista vazia', async () => {
    const grupo = {
      id: GRUPO,
      organizadorId: DONO,
      nome: 'Pelada',
      edicoes: [],
    } as unknown as GrupoPeladaEntity;
    grupos.findOne.mockResolvedValue(grupo);
    gerenciador.find.mockResolvedValue([]);

    await servico.remover(DONO, GRUPO);

    expect(gerenciador.softRemove).toHaveBeenCalledTimes(1);
    expect(gerenciador.softRemove).toHaveBeenCalledWith(grupo);
  });
});
