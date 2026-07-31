import { DataSource, EntityManager, FindOptionsWhere } from 'typeorm';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { FilaService } from './fila.service';

const DONO = 'usuario-1';
const PELADA = 'pelada-1';

interface RegistroFila {
  participanteId: string;
  ativo: boolean;
  posicao: number;
}

function criarServico(
  registros: RegistroFila[],
  participante?: Partial<ParticipantePeladaEntity>,
  jogadoresPorParticipante: Record<string, Record<string, unknown>> = {},
) {
  const gerenciador = {
    create: jest
      .fn()
      .mockImplementation((_entidade: unknown, dados: unknown) => dados),
    delete: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockResolvedValue([]),
    save: jest
      .fn()
      .mockImplementation((dados: unknown) => Promise.resolve(dados)),
  };

  const fila = {
    find: jest
      .fn()
      .mockImplementation(
        (opcoes: {
          where: FindOptionsWhere<FilaJogadorEntity>;
          order?: { posicao: 'ASC' };
        }) => {
          const somenteAtivos = opcoes.where.ativo;
          return Promise.resolve(
            registros
              .filter(
                (registro) =>
                  somenteAtivos === undefined ||
                  registro.ativo === somenteAtivos,
              )
              .sort((a, b) => a.posicao - b.posicao),
          );
        },
      ),
  };

  const servico = new FilaService(
    {
      findOne: jest.fn().mockResolvedValue({
        id: PELADA,
        status: StatusPelada.EM_ANDAMENTO,
      }),
    } as never,
    {
      findOne: jest.fn().mockResolvedValue(participante ?? null),
    } as never,
    fila as never,
    {
      findOne: jest
        .fn()
        .mockImplementation(
          (consulta: { where: { participanteId?: string } }) =>
            Promise.resolve(
              consulta.where.participanteId
                ? (jogadoresPorParticipante[consulta.where.participanteId] ??
                    null)
                : null,
            ),
        ),
    } as never,
    { findOne: jest.fn().mockResolvedValue(null) } as never,
    {
      transaction: (acao: (manager: EntityManager) => Promise<unknown>) =>
        acao(gerenciador as unknown as EntityManager),
    } as unknown as DataSource,
  );

  return { servico, gerenciador };
}

describe('FilaService', () => {
  it('reordena somente a fila ativa, ignorando entradas antigas', async () => {
    const { servico } = criarServico([
      { participanteId: 'ativo-1', ativo: true, posicao: 1 },
      { participanteId: 'antigo', ativo: false, posicao: 1 },
      { participanteId: 'ativo-2', ativo: true, posicao: 2 },
    ]);

    await expect(
      servico.reordenar(DONO, PELADA, ['ativo-2', 'ativo-1']),
    ).resolves.toEqual([]);
  });

  it('preserva o historico inativo ao reescrever a fila', async () => {
    const { servico, gerenciador } = criarServico([
      { participanteId: 'ativo-1', ativo: true, posicao: 1 },
      { participanteId: 'ativo-2', ativo: true, posicao: 2 },
    ]);

    await servico.reordenar(DONO, PELADA, ['ativo-2', 'ativo-1']);

    expect(gerenciador.delete).toHaveBeenCalledWith(FilaJogadorEntity, {
      peladaId: PELADA,
      ativo: true,
    });
  });

  it('nao recoloca uma entrada historica ao remover o ultimo da fila', async () => {
    const { servico, gerenciador } = criarServico([
      { participanteId: 'atual', ativo: true, posicao: 1 },
      { participanteId: 'antigo', ativo: false, posicao: 1 },
    ]);

    await servico.remover(DONO, PELADA, 'atual');

    expect(gerenciador.save).not.toHaveBeenCalled();
  });

  it('nao deixa goleiro fixo entrar na fila de rotacao', async () => {
    const { servico, gerenciador } = criarServico([], {
      id: 'goleiro',
      peladaId: PELADA,
      status: StatusParticipantePelada.PRESENTE,
      ehGoleiroFixo: true,
    });

    await expect(
      servico.adicionar(DONO, PELADA, 'goleiro'),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
    expect(gerenciador.save).not.toHaveBeenCalled();
  });

  it('nao deixa participante ausente furar a fila', async () => {
    const { servico, gerenciador } = criarServico([], {
      id: 'ausente',
      peladaId: PELADA,
      status: StatusParticipantePelada.CONFIRMADO,
      ehGoleiroFixo: false,
    });

    await expect(
      servico.adicionar(DONO, PELADA, 'ausente'),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
    expect(gerenciador.save).not.toHaveBeenCalled();
  });

  it('preserva a vaga e registra quem cobre o jogador descansando', async () => {
    const salvos: unknown[] = [];
    const gerenciador = {
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      create: jest
        .fn()
        .mockImplementation((_e: unknown, dados: unknown) => dados),
      save: jest.fn().mockImplementation((dados: unknown) => {
        salvos.push(dados);
        return Promise.resolve(dados);
      }),
      find: jest.fn().mockResolvedValue([]),
    };
    const servico = new FilaService(
      {
        findOne: jest.fn().mockResolvedValue({
          id: PELADA,
          status: StatusPelada.EM_ANDAMENTO,
        }),
      } as never,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 'fora',
          peladaId: PELADA,
          status: StatusParticipantePelada.DESCANSANDO,
        }),
      } as never,
      {
        find: jest
          .fn()
          .mockResolvedValue([
            { participanteId: 'entra', ativo: true, posicao: 1 },
          ]),
      } as never,
      {
        findOne: jest
          .fn()
          .mockImplementation(
            (consulta: { where: { participanteId?: string } }) =>
              Promise.resolve(
                consulta.where.participanteId === 'fora'
                  ? {
                      id: 'vaga-1',
                      timeId: 'time-a',
                      participanteId: 'fora',
                      ehGoleiro: false,
                      ativo: true,
                    }
                  : null,
              ),
          ),
      } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {
        transaction: (acao: (manager: EntityManager) => Promise<unknown>) =>
          acao(gerenciador as unknown as EntityManager),
      } as unknown as DataSource,
    );

    await servico.entrarNoLugarDe(DONO, PELADA, 'entra', 'fora');

    expect(gerenciador.update).not.toHaveBeenCalledWith(
      JogadorTimeEntity,
      'vaga-1',
      expect.anything(),
    );
    expect(salvos).toContainEqual(
      expect.objectContaining({
        timeId: 'time-a',
        participanteId: 'entra',
        substituiParticipanteId: 'fora',
        ativo: true,
      }),
    );
    expect(salvos.flat()).toContainEqual(
      expect.objectContaining({
        participanteId: 'entra',
        posicao: 1,
        ativo: true,
      }),
    );
    expect(
      salvos.flat().some((item) => {
        const registro = item as { participanteId?: string };
        return registro.participanteId === 'fora';
      }),
    ).toBe(false);
  });

  it('recusa colocar em outro time quem ja esta cobrindo uma vaga', async () => {
    const { servico } = criarServico(
      [{ participanteId: 'entra', ativo: true, posicao: 1 }],
      {
        id: 'fora',
        peladaId: PELADA,
        status: StatusParticipantePelada.DESCANSANDO,
      },
      {
        fora: {
          id: 'vaga-fora',
          timeId: 'time-a',
          participanteId: 'fora',
          ativo: true,
        },
        entra: {
          id: 'cobertura-atual',
          timeId: 'time-b',
          participanteId: 'entra',
          substituiParticipanteId: 'outro-titular',
          ativo: true,
        },
      },
    );

    await expect(
      servico.entrarNoLugarDe(DONO, PELADA, 'entra', 'fora'),
    ).rejects.toMatchObject({ codigo: 'PARTICIPANTE_EM_TIME' });
  });

  it('troca quem cobre uma vaga sem alterar as posicoes da fila', async () => {
    const { servico, gerenciador } = criarServico(
      [
        { participanteId: 'sai', ativo: true, posicao: 1 },
        { participanteId: 'entra', ativo: true, posicao: 2 },
      ],
      {
        id: 'sai',
        peladaId: PELADA,
        status: StatusParticipantePelada.PRESENTE,
      },
      {
        sai: {
          id: 'cobertura-atual',
          timeId: 'time-a',
          participanteId: 'sai',
          substituiParticipanteId: 'titular-fora',
          ativo: true,
        },
      },
    );

    await servico.entrarNoLugarDe(DONO, PELADA, 'entra', 'sai');

    expect(gerenciador.update).toHaveBeenCalledWith(
      JogadorTimeEntity,
      'cobertura-atual',
      { participanteId: 'entra' },
    );
    const registrosSalvos = gerenciador.save.mock.calls.flatMap(([registro]) =>
      Array.isArray(registro) ? registro : [registro],
    ) as Array<{ participanteId?: string; posicao?: number }>;
    expect(registrosSalvos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ participanteId: 'sai', posicao: 1 }),
        expect.objectContaining({ participanteId: 'entra', posicao: 2 }),
      ]),
    );
  });
});
