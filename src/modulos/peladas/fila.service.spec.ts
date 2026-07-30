import { DataSource, EntityManager, FindOptionsWhere } from 'typeorm';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
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
) {
  const gerenciador = {
    create: jest
      .fn()
      .mockImplementation((_entidade: unknown, dados: unknown) => dados),
    delete: jest.fn().mockResolvedValue({}),
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
    { findOne: jest.fn().mockResolvedValue(null) } as never,
    {} as never,
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
});
