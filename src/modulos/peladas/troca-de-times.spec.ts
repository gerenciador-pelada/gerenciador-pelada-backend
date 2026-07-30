import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { ParticipantesService } from './participantes.service';

const DONO = 'usuario-1';
const PELADA = 'pelada-1';
const A = 'p-a';
const B = 'p-b';

function criarServico(opcoes: {
  partidaEmAndamento?: boolean;
  mesmoTime?: boolean;
  semTime?: boolean;
  aEhGoleiro?: boolean;
  bEhGoleiro?: boolean;
}) {
  const atualizacoes: { id: string; dados: Record<string, unknown> }[] = [];

  const jogadoresTime = {
    findOne: jest
      .fn()
      .mockImplementation((opcs: { where: { participanteId: string } }) => {
        if (opcoes.semTime) return Promise.resolve(null);
        const ehA = opcs.where.participanteId === A;
        return Promise.resolve({
          id: ehA ? 'jt-a' : 'jt-b',
          timeId: ehA || opcoes.mesmoTime ? 'time-a' : 'time-b',
          ehGoleiro: ehA
            ? (opcoes.aEhGoleiro ?? false)
            : (opcoes.bEhGoleiro ?? false),
          ativo: true,
        });
      }),
    update: jest
      .fn()
      .mockImplementation((id: string, dados: Record<string, unknown>) => {
        atualizacoes.push({ id, dados });
        return Promise.resolve({});
      }),
    find: jest.fn().mockResolvedValue([]),
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
    { findOne: jest.fn() } as never,
    { findOne: jest.fn(), update: jest.fn() } as never,
    jogadoresTime as never,
    {
      findOne: jest
        .fn()
        .mockResolvedValue(
          opcoes.partidaEmAndamento
            ? { id: 'partida-1', status: StatusPartida.EM_ANDAMENTO }
            : null,
        ),
    } as never,
    { count: jest.fn().mockResolvedValue(0) } as never,
    {} as never,
  );

  return { servico, atualizacoes };
}

describe('Trocar jogadores de time antes de começar', () => {
  it('troca os dois de lado', async () => {
    const { servico, atualizacoes } = criarServico({});

    await servico.trocarJogadoresDeTime(DONO, PELADA, A, B);

    expect(atualizacoes).toEqual([
      { id: 'jt-a', dados: { timeId: 'time-b', ehGoleiro: false } },
      { id: 'jt-b', dados: { timeId: 'time-a', ehGoleiro: false } },
    ]);
  });

  it('o papel de goleiro fica com a vaga, nao com a pessoa', async () => {
    // A e goleiro do time A. Ao trocar, quem assume a vaga dele assume o gol,
    // e A vira jogador de linha no time B.
    const { servico, atualizacoes } = criarServico({ aEhGoleiro: true });

    await servico.trocarJogadoresDeTime(DONO, PELADA, A, B);

    expect(atualizacoes[0].dados.ehGoleiro).toBe(false);
    expect(atualizacoes[1].dados.ehGoleiro).toBe(true);
  });

  it('recusa com a partida ja em andamento', async () => {
    const { servico, atualizacoes } = criarServico({
      partidaEmAndamento: true,
    });

    await expect(
      servico.trocarJogadoresDeTime(DONO, PELADA, A, B),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
    expect(atualizacoes).toHaveLength(0);
  });

  it('recusa quando os dois ja estao no mesmo time', async () => {
    const { servico, atualizacoes } = criarServico({ mesmoTime: true });

    await expect(
      servico.trocarJogadoresDeTime(DONO, PELADA, A, B),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
    expect(atualizacoes).toHaveLength(0);
  });

  it('recusa quando algum nao esta escalado', async () => {
    const { servico } = criarServico({ semTime: true });

    await expect(
      servico.trocarJogadoresDeTime(DONO, PELADA, A, B),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
  });

  it('recusa trocar a pessoa com ela mesma', async () => {
    const { servico } = criarServico({});

    await expect(
      servico.trocarJogadoresDeTime(DONO, PELADA, A, A),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
  });
});
