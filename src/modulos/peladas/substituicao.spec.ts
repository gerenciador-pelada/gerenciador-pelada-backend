import { DataSource, EntityManager } from 'typeorm';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { PartidasService } from './partidas.service';

const DONO = 'usuario-1';
const PARTIDA = 'partida-1';
const SAI = 'p-sai';
const ENTRA = 'p-entra';

function criarAmbiente(opcoes: {
  status?: StatusPartida;
  saiEmCampo?: boolean;
  entraJaEmCampo?: boolean;
  saiEhGoleiro?: boolean;
  saiDescansando?: boolean;
}) {
  const salvos: Record<string, unknown>[] = [];
  const atualizados: { entidade: unknown; dados: unknown }[] = [];

  const gerenciador = {
    findOne: jest
      .fn()
      .mockImplementation((entidade: unknown, opcs: { where: unknown }) => {
        const onde = opcs.where as { participanteId?: string };
        if (entidade === ParticipacaoPartidaEntity) {
          if (onde.participanteId === SAI)
            return Promise.resolve(
              opcoes.saiEmCampo === false
                ? null
                : {
                    id: 'pp1',
                    timeId: 'time-a',
                    ehGoleiro: opcoes.saiEhGoleiro ?? false,
                  },
            );
          return Promise.resolve(opcoes.entraJaEmCampo ? { id: 'pp2' } : null);
        }
        if (entidade === JogadorTimeEntity)
          return Promise.resolve({
            id: 'jt1',
            timeId: 'time-a',
            ehGoleiro: opcoes.saiEhGoleiro ?? false,
          });
        if (entidade === ParticipantePeladaEntity)
          return Promise.resolve({
            id: SAI,
            status: opcoes.saiDescansando
              ? StatusParticipantePelada.DESCANSANDO
              : StatusParticipantePelada.JOGANDO,
          });
        return Promise.resolve(null);
      }),
    update: jest.fn().mockImplementation((entidade, _id, dados: unknown) => {
      atualizados.push({ entidade, dados });
      return Promise.resolve({});
    }),
    create: jest.fn().mockImplementation((_e, dados: unknown) => dados),
    save: jest.fn().mockImplementation((d: unknown) => {
      salvos.push(d as Record<string, unknown>);
      return Promise.resolve(d);
    }),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ maximo: '3' }),
    }),
  };

  const construtor = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({
      id: PARTIDA,
      peladaId: 'pelada-1',
      timeCasaId: 'time-a',
      timeVisitanteId: 'time-b',
      status: opcoes.status ?? StatusPartida.EM_ANDAMENTO,
    }),
  };

  const servico = new PartidasService(
    { createQueryBuilder: () => construtor, save: jest.fn() } as never,
    {
      transaction: (cb: (m: EntityManager) => Promise<unknown>) =>
        cb(gerenciador as unknown as EntityManager),
    } as unknown as DataSource,
  );

  return { servico, salvos, atualizados };
}

describe('Substituição durante a partida', () => {
  it('coloca quem entra no mesmo time e quem sai no fim da fila', async () => {
    const { servico, salvos } = criarAmbiente({});

    const r = await servico.substituir(DONO, PARTIDA, SAI, ENTRA);

    expect(r).toEqual({ saiu: SAI, entrou: ENTRA, ehGoleiro: false });

    const noTime = salvos.find(
      (s) => 'timeId' in s && s.participanteId === ENTRA && 'ehGoleiro' in s,
    );
    expect(noTime?.timeId).toBe('time-a');

    // Quem sai volta para o fim da fila: a ultima posicao era 3.
    const naFila = salvos.find(
      (s) => s.participanteId === SAI && 'posicao' in s,
    );
    expect(naFila?.posicao).toBe(4);
  });

  it('quem entra herda o papel de goleiro', async () => {
    const { servico, salvos } = criarAmbiente({ saiEhGoleiro: true });

    const r = await servico.substituir(DONO, PARTIDA, SAI, ENTRA);

    expect(r.ehGoleiro).toBe(true);
    // Sem isto o time ficaria com dois de linha e o gol vazio.
    const entradas = salvos.filter((s) => s.participanteId === ENTRA);
    expect(entradas.every((e) => e.ehGoleiro === true)).toBe(true);
  });

  it('mantem a participacao de quem sai, marcando quando saiu', async () => {
    const { servico, atualizados } = criarAmbiente({});

    await servico.substituir(DONO, PARTIDA, SAI, ENTRA);

    // Os dois contam como tendo jogado: a participacao nao e apagada.
    const marcouSaida = atualizados.find(
      (a) =>
        a.entidade === ParticipacaoPartidaEntity &&
        (a.dados as { saiuEm?: Date }).saiuEm instanceof Date,
    );
    expect(marcouSaida).toBeDefined();
  });

  it('tira quem entra da fila', async () => {
    const { servico, atualizados } = criarAmbiente({});

    await servico.substituir(DONO, PARTIDA, SAI, ENTRA);

    const saiuDaFila = atualizados.find(
      (a) =>
        a.entidade === FilaJogadorEntity &&
        (a.dados as { ativo?: boolean }).ativo === false,
    );
    expect(saiuDaFila).toBeDefined();
  });

  it('substitui a vaga preservada sem enfileirar quem continua descansando', async () => {
    const { servico, salvos } = criarAmbiente({
      saiEmCampo: false,
      saiDescansando: true,
    });

    const resultado = await servico.substituir(DONO, PARTIDA, SAI, ENTRA);

    expect(resultado).toEqual({ saiu: SAI, entrou: ENTRA, ehGoleiro: false });
    expect(
      salvos.some(
        (item) => item.participanteId === ENTRA && item.timeId === 'time-a',
      ),
    ).toBe(true);
    expect(
      salvos.some((item) => item.participanteId === SAI && 'posicao' in item),
    ).toBe(false);
  });

  it('recusa quando quem sai nao esta em campo', async () => {
    const { servico } = criarAmbiente({ saiEmCampo: false });

    await expect(
      servico.substituir(DONO, PARTIDA, SAI, ENTRA),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
  });

  it('recusa quando quem entra ja esta em campo', async () => {
    const { servico } = criarAmbiente({ entraJaEmCampo: true });

    await expect(
      servico.substituir(DONO, PARTIDA, SAI, ENTRA),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
  });

  it('recusa substituir a mesma pessoa', async () => {
    const { servico } = criarAmbiente({});

    await expect(
      servico.substituir(DONO, PARTIDA, SAI, SAI),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
  });

  it('recusa com a partida ainda aguardando', async () => {
    const { servico } = criarAmbiente({ status: StatusPartida.AGUARDANDO });

    await expect(
      servico.substituir(DONO, PARTIDA, SAI, ENTRA),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
  });
});
