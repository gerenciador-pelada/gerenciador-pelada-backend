import { DataSource, EntityManager } from 'typeorm';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { PartidasService } from './partidas.service';

const DONO = 'usuario-1';
const PARTIDA = 'partida-1';

/**
 * Elencos: o time da casa tem 2 de linha e 1 goleiro fixo; o visitante idem.
 * A fila tem 2 de linha esperando. Time de 2 por lado.
 */
const ELENCO = [
  { timeId: 'time-a', participanteId: 'a1', ehGoleiro: false, ativo: true },
  { timeId: 'time-a', participanteId: 'a2', ehGoleiro: false, ativo: true },
  { timeId: 'time-a', participanteId: 'gkA', ehGoleiro: true, ativo: true },
  { timeId: 'time-b', participanteId: 'b1', ehGoleiro: false, ativo: true },
  { timeId: 'time-b', participanteId: 'b2', ehGoleiro: false, ativo: true },
  { timeId: 'time-b', participanteId: 'gkB', ehGoleiro: true, ativo: true },
];

const PARTICIPANTES: Record<
  string,
  { id: string; ordemChegada: number; ehGoleiroFixo: boolean }
> = {
  a1: { id: 'a1', ordemChegada: 1, ehGoleiroFixo: false },
  a2: { id: 'a2', ordemChegada: 2, ehGoleiroFixo: false },
  gkA: { id: 'gkA', ordemChegada: 100, ehGoleiroFixo: true },
  b1: { id: 'b1', ordemChegada: 3, ehGoleiroFixo: false },
  b2: { id: 'b2', ordemChegada: 4, ehGoleiroFixo: false },
  gkB: { id: 'gkB', ordemChegada: 101, ehGoleiroFixo: true },
  f1: { id: 'f1', ordemChegada: 5, ehGoleiroFixo: false },
  f2: { id: 'f2', ordemChegada: 6, ehGoleiroFixo: false },
  subA: { id: 'subA', ordemChegada: 2, ehGoleiroFixo: false },
};

function criarAmbiente(
  opcoes: {
    semGoleiroFixo?: boolean;
    descansando?: string;
    substitutoTemporario?: boolean;
    substitutoNoPerdedor?: boolean;
    filaSomenteSubstituto?: boolean;
  } = {},
) {
  const elencoBase = opcoes.semGoleiroFixo
    ? ELENCO.filter((e) => !e.ehGoleiro)
    : ELENCO;
  const elenco = opcoes.substitutoTemporario
    ? [
        ...elencoBase,
        {
          id: 'jt-sub-a',
          timeId: opcoes.substitutoNoPerdedor ? 'time-b' : 'time-a',
          participanteId: 'subA',
          substituiParticipanteId: opcoes.substitutoNoPerdedor ? 'b1' : 'a1',
          ehGoleiro: false,
          ativo: true,
        },
      ]
    : elencoBase;
  const participantesBase = opcoes.semGoleiroFixo
    ? Object.fromEntries(
        Object.entries(PARTICIPANTES).map(([k, v]) => [
          k,
          { ...v, ehGoleiroFixo: false },
        ]),
      )
    : PARTICIPANTES;
  const participantes = Object.fromEntries(
    Object.entries(participantesBase).map(([id, participante]) => [
      id,
      id === opcoes.descansando
        ? { ...participante, status: StatusParticipantePelada.DESCANSANDO }
        : participante,
    ]),
  );

  const jogadoresTimeSalvos: JogadorTimeEntity[] = [];
  const filaSalva: FilaJogadorEntity[] = [];
  let proximoTime = 0;

  const gerenciador = {
    findOne: jest.fn().mockResolvedValue({
      id: 'pelada-1',
      configuracao: {
        permiteEmpate: true,
        jogadoresLinhaPorTime: 2,
        regraEmpate: 'AMBOS_SAEM',
        pontosVitoria: 3,
        pontosEmpate: 1,
        pontosDerrota: 0,
        pontosGol: 0,
        pontosAssistencia: 0,
        pontosBolaCheia: 0,
        pontosBolaMurcha: 0,
      },
    }),
    findOneByOrFail: jest.fn().mockImplementation((_e, onde: { id: string }) =>
      Promise.resolve({
        id: onde.id,
        partidasConsecutivas: 0,
        vitoriasConsecutivas: 0,
      }),
    ),
    count: jest.fn().mockResolvedValue(2),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    find: jest
      .fn()
      .mockImplementation((entidade: unknown, consulta: unknown) => {
        const o = consulta as { where?: unknown };
        if (entidade === JogadorTimeEntity) {
          const onde = o.where as { timeId: string }[] | { timeId: string };
          const ids = Array.isArray(onde)
            ? onde.map((x) => x.timeId)
            : [onde.timeId];
          const encontrados = elenco.filter((e) => ids.includes(e.timeId));
          return Promise.resolve(
            !Array.isArray(onde) && 'substituiParticipanteId' in onde
              ? encontrados.filter(
                  (e) =>
                    'substituiParticipanteId' in e &&
                    Boolean(e.substituiParticipanteId),
                )
              : encontrados,
          );
        }
        if (entidade === FilaJogadorEntity) {
          if (opcoes.filaSomenteSubstituto) {
            return Promise.resolve([{ participanteId: 'subA', posicao: 1 }]);
          }
          const registros = [
            { participanteId: 'f1', posicao: 1 },
            { participanteId: 'f2', posicao: 2 },
          ];
          if (opcoes.substitutoTemporario) {
            registros.push({ participanteId: 'subA', posicao: 3 });
          }
          return Promise.resolve(registros);
        }
        // ParticipantePelada e ParticipacaoPartida
        const onde = o.where as { id: string }[] | undefined;
        if (Array.isArray(onde)) {
          return Promise.resolve(
            onde.map((x) => participantes[x.id]).filter(Boolean),
          );
        }
        return Promise.resolve([]);
      }),
    create: jest.fn().mockImplementation((_e, dados: unknown) => dados),
    save: jest.fn().mockImplementation((dados: unknown) => {
      const lista = Array.isArray(dados) ? dados : [dados];
      for (const item of lista) {
        const registro = item as Record<string, unknown>;
        if ('timeId' in registro && 'participanteId' in registro) {
          jogadoresTimeSalvos.push(item as JogadorTimeEntity);
        }
        if ('posicao' in registro) filaSalva.push(item as FilaJogadorEntity);
        if ('ordemCriacao' in registro) {
          proximoTime += 1;
          (registro as { id: string }).id = `time-novo-${proximoTime}`;
        }
      }
      return Promise.resolve(dados);
    }),
    // A contagem de partidas jogadas roda por consulta agregada; neste
    // ambiente ninguem jogou nada ainda, entao o desempate cai em ordem de
    // chegada, que e o que estes testes exercitam.
    createQueryBuilder: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    }),
  };

  const construtor = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({
      id: PARTIDA,
      peladaId: 'pelada-1',
      numero: 1,
      timeCasaId: 'time-a',
      timeVisitanteId: 'time-b',
      golsCasa: 2,
      golsVisitante: 1,
      status: StatusPartida.EM_ANDAMENTO,
    }),
  };

  const servico = new PartidasService(
    { createQueryBuilder: () => construtor, save: jest.fn() } as never,
    {
      transaction: (cb: (m: EntityManager) => Promise<unknown>) =>
        cb(gerenciador as unknown as EntityManager),
    } as unknown as DataSource,
  );

  return { servico, jogadoresTimeSalvos, filaSalva, gerenciador };
}

describe('Rotação com goleiro fixo', () => {
  it('não manda o goleiro fixo do time perdedor para a fila', async () => {
    const { servico, filaSalva } = criarAmbiente();

    await servico.finalizar(DONO, PARTIDA);

    // O visitante perdeu (2x1). Seus jogadores de linha voltam para a fila;
    // o goleiro fixo, não — ele fica no gol.
    const naFila = filaSalva.map((f) => f.participanteId);
    expect(naFila).not.toContain('gkB');
    expect(naFila).not.toContain('gkA');
  });

  it('entrega o goleiro fixo ao time que assume o lado', async () => {
    const { servico, jogadoresTimeSalvos } = criarAmbiente();

    await servico.finalizar(DONO, PARTIDA);

    const goleirosDoTimeNovo = jogadoresTimeSalvos.filter(
      (j) => j.ehGoleiro && j.timeId.startsWith('time-novo'),
    );
    expect(goleirosDoTimeNovo.map((j) => j.participanteId)).toContain('gkB');
  });

  it('sem goleiro fixo, o time so nao tem goleiro e a fila segue igual', async () => {
    // Pelada sem goleiro fixo: ninguem e promovido, ninguem e puxado da fila
    // para o gol. O time simplesmente joga sem goleiro fixo.
    const { servico, jogadoresTimeSalvos, filaSalva } = criarAmbiente({
      semGoleiroFixo: true,
    });

    await servico.finalizar(DONO, PARTIDA);

    const doTimeNovo = jogadoresTimeSalvos.filter((j) =>
      j.timeId.startsWith('time-novo'),
    );
    expect(doTimeNovo.every((j) => !j.ehGoleiro)).toBe(true);
    expect(doTimeNovo.map((j) => j.participanteId)).toEqual(['f1', 'f2']);

    // Os dois que perderam voltam para a fila, sem tratamento especial.
    expect(filaSalva.map((f) => f.participanteId).sort()).toEqual(['b1', 'b2']);
  });

  it('não conta o goleiro fixo como vaga de jogador de linha', async () => {
    const { servico, jogadoresTimeSalvos } = criarAmbiente();

    await servico.finalizar(DONO, PARTIDA);

    // Time de 2: o desafiante entra com os 2 da fila, e o goleiro vem além
    // dessas vagas — não no lugar de um jogador de linha.
    const linhaDoTimeNovo = jogadoresTimeSalvos.filter(
      (j) => !j.ehGoleiro && j.timeId.startsWith('time-novo'),
    );
    expect(linhaDoTimeNovo.map((j) => j.participanteId)).toEqual(['f1', 'f2']);
  });

  it('nao leva jogador descansando do time perdedor para fila ou novo time', async () => {
    const { servico, jogadoresTimeSalvos, filaSalva } = criarAmbiente({
      descansando: 'b1',
    });

    await servico.finalizar(DONO, PARTIDA);

    expect(filaSalva.map((f) => f.participanteId)).not.toContain('b1');
    expect(jogadoresTimeSalvos.map((j) => j.participanteId)).not.toContain(
      'b1',
    );
  });

  it('nao herda goleiro fixo que continua descansando', async () => {
    const { servico, jogadoresTimeSalvos } = criarAmbiente({
      descansando: 'gkB',
    });

    await servico.finalizar(DONO, PARTIDA);

    expect(jogadoresTimeSalvos.map((j) => j.participanteId)).not.toContain(
      'gkB',
    );
  });

  it('preserva a vez do substituto na fila ao devolver a vaga ao titular', async () => {
    const { servico, filaSalva, gerenciador } = criarAmbiente({
      descansando: 'a1',
      substitutoTemporario: true,
    });

    await servico.finalizar(DONO, PARTIDA);

    expect(filaSalva.map((f) => f.participanteId)).toEqual([
      'subA',
      'b1',
      'b2',
    ]);
    expect(filaSalva.map((f) => f.participanteId)).not.toContain('a1');
    expect(gerenciador.update).toHaveBeenCalledWith(
      JogadorTimeEntity,
      'jt-sub-a',
      expect.objectContaining({ ativo: false }),
    );
  });

  it('nao escala duas vezes o substituto do time perdedor que segue na fila', async () => {
    const { servico, jogadoresTimeSalvos, filaSalva } = criarAmbiente({
      descansando: 'b1',
      substitutoTemporario: true,
      substitutoNoPerdedor: true,
      filaSomenteSubstituto: true,
    });

    await servico.finalizar(DONO, PARTIDA);

    const linhaDoTimeNovo = jogadoresTimeSalvos
      .filter((j) => !j.ehGoleiro && j.timeId.startsWith('time-novo'))
      .map((j) => j.participanteId);
    expect(linhaDoTimeNovo).toEqual(['subA', 'b2']);
    expect(filaSalva.map((j) => j.participanteId)).not.toContain('subA');
  });
});
