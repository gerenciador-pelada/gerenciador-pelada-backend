import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { ParticipantesService } from './participantes.service';

const DONO = 'usuario-1';
const PELADA = 'pelada-1';

function criarServico(chegaram: Partial<ParticipantePeladaEntity>[]) {
  const atualizacoes: { id: string; ordem: number }[] = [];

  const gerenciador = {
    update: jest
      .fn()
      .mockImplementation((_e, id: string, dados: { ordemChegada: number }) => {
        atualizacoes.push({ id, ordem: dados.ordemChegada });
        return Promise.resolve({});
      }),
    find: jest.fn().mockResolvedValue(chegaram),
  };

  const servico = new ParticipantesService(
    {
      findOne: jest.fn().mockResolvedValue({
        id: PELADA,
        status: StatusPelada.EM_ANDAMENTO,
        configuracao: { maximoJogadores: 20 },
      }),
    } as never,
    {} as never,
    { find: jest.fn().mockResolvedValue(chegaram) } as never,
    {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as never,
    { findOne: jest.fn(), update: jest.fn(), find: jest.fn() } as never,
    { findOne: jest.fn().mockResolvedValue(null) } as never,
    { count: jest.fn().mockResolvedValue(0) } as never,
    {
      transaction: (cb: (m: EntityManager) => Promise<unknown>) =>
        cb(gerenciador as unknown as EntityManager),
    } as unknown as DataSource,
  );

  return { servico, atualizacoes };
}

describe('ParticipantesService.reordenar', () => {
  const chegaram = [
    { id: 'a', ordemChegada: 1 },
    { id: 'b', ordemChegada: 2 },
    { id: 'c', ordemChegada: 3 },
  ];

  it('escreve em duas fases para nao colidir com o indice unico', async () => {
    // O indice (peladaId, ordemChegada) e UNIQUE. Escrever as posicoes finais
    // direto faria a troca de 1 com 2 bater no registro que ainda ocupa o 2.
    const { servico, atualizacoes } = criarServico(chegaram);

    await servico.reordenar(DONO, PELADA, ['b', 'a', 'c']);

    const negativas = atualizacoes.slice(0, 3);
    const finais = atualizacoes.slice(3);

    expect(negativas.every((u) => u.ordem < 0)).toBe(true);
    expect(finais).toEqual([
      { id: 'b', ordem: 1 },
      { id: 'a', ordem: 2 },
      { id: 'c', ordem: 3 },
    ]);
  });

  it('aceita reordenar com a pelada ja em andamento', async () => {
    // Quem chegou continua na ordem mesmo com status JOGANDO ou AGUARDANDO.
    const { servico } = criarServico(chegaram);

    await expect(
      servico.reordenar(DONO, PELADA, ['c', 'b', 'a']),
    ).resolves.toBeDefined();
  });

  it('recusa ordem que nao cobre todos os que chegaram', async () => {
    const { servico, atualizacoes } = criarServico(chegaram);

    await expect(
      servico.reordenar(DONO, PELADA, ['a', 'b']),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
    expect(atualizacoes).toHaveLength(0);
  });

  it('recusa ordem com id repetido', async () => {
    const { servico, atualizacoes } = criarServico(chegaram);

    await expect(
      servico.reordenar(DONO, PELADA, ['a', 'a', 'b']),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
    expect(atualizacoes).toHaveLength(0);
  });
});

interface OpcoesGoleiro {
  participanteExiste?: boolean;
  status?: StatusParticipantePelada;
  ordemChegada?: number | null;
  naFila?: boolean;
  emTime?: boolean;
  statusPelada?: StatusPelada;
}

function criarServicoGoleiro(
  ehGoleiroFixo: boolean,
  opcoes: OpcoesGoleiro = {},
) {
  const participante = {
    id: 'participante-1',
    peladaId: PELADA,
    jogadorId: 'jogador-1',
    ehGoleiroFixo,
    status: opcoes.status ?? StatusParticipantePelada.AGUARDANDO,
    ordemChegada: opcoes.ordemChegada === undefined ? 4 : opcoes.ordemChegada,
  } as ParticipantePeladaEntity;
  const fila = opcoes.naFila
    ? [
        {
          id: 'fila-1',
          peladaId: PELADA,
          participanteId: participante.id,
          posicao: 3,
          ativo: true,
          saiuEm: null,
        },
      ]
    : [];
  const novasEntradas: Partial<FilaJogadorEntity>[] = [];

  const gerenciador = {
    findOne: jest
      .fn()
      .mockImplementation(
        (
          entidade: object,
          consulta: { where?: { participanteId?: string } },
        ) => {
          if (entidade === ParticipantePeladaEntity) {
            return Promise.resolve(
              opcoes.participanteExiste === false ? null : participante,
            );
          }
          if (entidade === JogadorTimeEntity) {
            return Promise.resolve(
              opcoes.emTime
                ? {
                    id: 'jogador-time-1',
                    participanteId: consulta.where?.participanteId,
                    ativo: true,
                  }
                : null,
            );
          }
          if (entidade === FilaJogadorEntity) {
            return Promise.resolve(
              fila.find(
                (item) =>
                  item.participanteId === consulta.where?.participanteId &&
                  item.ativo,
              ) ?? null,
            );
          }
          return Promise.resolve(null);
        },
      ),
    update: jest
      .fn()
      .mockImplementation(
        (
          entidade: object,
          criterio: { participanteId?: string; ativo?: boolean },
          dados: { ativo?: boolean; saiuEm?: Date },
        ) => {
          if (entidade === FilaJogadorEntity) {
            for (const item of fila) {
              if (
                item.participanteId === criterio.participanteId &&
                item.ativo === criterio.ativo
              ) {
                Object.assign(item, dados);
              }
            }
          }
          return Promise.resolve({});
        },
      ),
    save: jest.fn().mockImplementation((registro: object) => {
      if ('posicao' in registro) {
        novasEntradas.push(registro as Partial<FilaJogadorEntity>);
      }
      return Promise.resolve(registro);
    }),
    create: jest.fn((_entidade: object, dados: object) => dados),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ maximo: '5' }),
    })),
  };

  const servico = new ParticipantesService(
    {
      findOne: jest.fn().mockResolvedValue({
        id: PELADA,
        status: opcoes.statusPelada ?? StatusPelada.EM_ANDAMENTO,
        configuracao: { maximoJogadores: 20 },
      }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      transaction: (cb: (m: EntityManager) => Promise<unknown>) =>
        cb(gerenciador as unknown as EntityManager),
    } as unknown as DataSource,
  );

  return { servico, participante, fila, novasEntradas };
}

describe('ParticipantesService.alterarGoleiroFixo', () => {
  it('marca como goleiro fixo e retira da fila de linha', async () => {
    const { servico, participante, fila } = criarServicoGoleiro(false, {
      naFila: true,
    });

    const atualizado = await servico.alterarGoleiroFixo(
      DONO,
      PELADA,
      participante.id,
      true,
    );

    expect(atualizado.ehGoleiroFixo).toBe(true);
    expect(fila[0]).toMatchObject({
      ativo: false,
      saiuEm: expect.any(Date),
    });
  });

  it('desmarca e coloca um jogador disponivel no fim da fila', async () => {
    const { servico, participante, novasEntradas } = criarServicoGoleiro(true);

    const atualizado = await servico.alterarGoleiroFixo(
      DONO,
      PELADA,
      participante.id,
      false,
    );

    expect(atualizado.ehGoleiroFixo).toBe(false);
    expect(novasEntradas).toEqual([
      expect.objectContaining({
        peladaId: PELADA,
        participanteId: participante.id,
        posicao: 6,
        ativo: true,
        saiuEm: null,
      }),
    ]);
  });

  it('nao enfileira quem ainda nao chegou', async () => {
    const { servico, participante, novasEntradas } = criarServicoGoleiro(true, {
      status: StatusParticipantePelada.CONFIRMADO,
      ordemChegada: null,
    });

    await servico.alterarGoleiroFixo(DONO, PELADA, participante.id, false);

    expect(novasEntradas).toHaveLength(0);
  });

  it('nao enfileira quem pertence a um time ativo', async () => {
    const { servico, participante, novasEntradas } = criarServicoGoleiro(true, {
      emTime: true,
    });

    await servico.alterarGoleiroFixo(DONO, PELADA, participante.id, false);

    expect(novasEntradas).toHaveLength(0);
  });

  it('repetir a classificacao atual nao altera a fila', async () => {
    const { servico, participante, fila, novasEntradas } = criarServicoGoleiro(
      true,
      { naFila: true },
    );

    await servico.alterarGoleiroFixo(DONO, PELADA, participante.id, true);

    expect(fila[0]).toMatchObject({ ativo: true, saiuEm: null });
    expect(novasEntradas).toHaveLength(0);
  });

  it('recusa participante que nao pertence a pelada', async () => {
    const { servico, participante } = criarServicoGoleiro(false, {
      participanteExiste: false,
    });

    await expect(
      servico.alterarGoleiroFixo(DONO, PELADA, participante.id, true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

/**
 * O caminho de volta de quem desistiu.
 *
 * Isto nasceu de um incidente real: durante um jogo alguém tirou um jogador
 * por engano e não conseguiu recolocá-lo. `retornar` recusa quem desistiu
 * dizendo "precisa ser adicionado de novo", e `adicionar` recusava com "já
 * participa da pelada" — a linha continua existindo, só com outro status. A
 * mensagem mandava fazer exatamente o que era impossível.
 */
describe('ParticipantesService.adicionar de quem desistiu', () => {
  function montar(participanteExistente: object | null) {
    const salvos: object[] = [];
    const participantes = {
      findOne: jest.fn().mockResolvedValue(participanteExistente),
      save: jest.fn().mockImplementation((p: object) => {
        salvos.push(p);
        return Promise.resolve(p);
      }),
      create: jest.fn().mockImplementation((p: object) => p),
      count: jest.fn().mockResolvedValue(0),
    };
    const servico = new ParticipantesService(
      {
        findOne: jest.fn().mockResolvedValue({
          id: PELADA,
          status: StatusPelada.EM_ANDAMENTO,
          configuracao: { maximoJogadores: 20 },
        }),
      } as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'jog-1' }) } as never,
      participantes as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as unknown as DataSource,
    );
    return { servico, salvos };
  }

  it('devolve quem desistiu ao estado anterior em vez de recusar', async () => {
    const { servico, salvos } = montar({
      id: 'part-1',
      status: StatusParticipantePelada.DESISTIU,
      chegadaEm: new Date(),
      ehGoleiroFixo: false,
    });

    await servico.adicionar('dono', PELADA, { jogadorId: 'jog-1' } as never);

    // Já tinha chegado, então volta jogável — e não como quem ainda vai chegar.
    expect(salvos[0]).toMatchObject({
      id: 'part-1',
      status: StatusParticipantePelada.PRESENTE,
    });
  });

  it('quem nunca chegou volta como confirmado', async () => {
    const { servico, salvos } = montar({
      id: 'part-2',
      status: StatusParticipantePelada.DESISTIU,
      chegadaEm: null,
      ehGoleiroFixo: false,
    });

    await servico.adicionar('dono', PELADA, { jogadorId: 'jog-1' } as never);

    expect(salvos[0]).toMatchObject({
      status: StatusParticipantePelada.CONFIRMADO,
    });
  });

  it('continua recusando quem ja participa de verdade', async () => {
    const { servico } = montar({
      id: 'part-3',
      status: StatusParticipantePelada.PRESENTE,
      chegadaEm: new Date(),
    });

    await expect(
      servico.adicionar('dono', PELADA, { jogadorId: 'jog-1' } as never),
    ).rejects.toMatchObject({ codigo: 'PARTICIPANTE_DUPLICADO' });
  });
});
