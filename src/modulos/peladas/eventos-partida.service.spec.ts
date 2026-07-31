import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { EventosPartidaService } from './eventos-partida.service';

const DONO = 'usuario-1';
const PARTIDA = 'partida-1';
const TIME_CASA = 'time-casa';
const TIME_VISITANTE = 'time-visitante';
const CASA = 'participante-casa';
const VISITANTE = 'participante-visitante';

interface OpcoesCenario {
  status?: StatusPartida;
}

function criarCenario({
  status = StatusPartida.EM_ANDAMENTO,
}: OpcoesCenario = {}) {
  const partida = {
    id: PARTIDA,
    peladaId: 'pelada-1',
    timeCasaId: TIME_CASA,
    timeVisitanteId: TIME_VISITANTE,
    golsCasa: 0,
    golsVisitante: 0,
    status,
  } as PartidaEntity;
  const participacoes = [
    { partidaId: PARTIDA, participanteId: CASA, timeId: TIME_CASA },
    {
      partidaId: PARTIDA,
      participanteId: VISITANTE,
      timeId: TIME_VISITANTE,
    },
  ];
  const eventos: EventoPartidaEntity[] = [];
  const construtor = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(partida),
  };
  const repositorioPartidas = {
    createQueryBuilder: jest.fn().mockReturnValue(construtor),
    save: jest
      .fn()
      .mockImplementation((entrada: PartidaEntity) => Promise.resolve(entrada)),
  };
  const repositorioParticipacoes = {
    findOne: jest
      .fn()
      .mockImplementation(
        (opcoes: { where: { partidaId: string; participanteId: string } }) =>
          Promise.resolve(
            participacoes.find(
              (participacao) =>
                participacao.partidaId === opcoes.where.partidaId &&
                participacao.participanteId === opcoes.where.participanteId,
            ) ?? null,
          ),
      ),
  };
  const repositorioEventos = {
    create: jest
      .fn()
      .mockImplementation((entrada: Partial<EventoPartidaEntity>) => entrada),
    save: jest.fn().mockImplementation((entrada: EventoPartidaEntity) => {
      // Spread antes do id: o id gerado aqui e o que vale. Na ordem inversa
      // ele era silenciosamente sobrescrito quando a entrada trazia um.
      const salvo = { ...entrada, id: `evento-${eventos.length + 1}` };
      eventos.push(salvo);
      return Promise.resolve(salvo);
    }),
  };
  const historico = {
    registrar: jest.fn().mockResolvedValue({}),
  };
  const servico = new EventosPartidaService(
    repositorioPartidas as never,
    repositorioParticipacoes as never,
    repositorioEventos as never,
    historico as never,
  );

  return { servico, partida, eventos };
}

describe('EventosPartidaService', () => {
  it('credita o gol contra ao adversario do autor', async () => {
    const { servico, partida, eventos } = criarCenario();

    await servico.registrar(DONO, PARTIDA, {
      tipo: TipoEventoPartida.GOL_CONTRA,
      participanteId: VISITANTE,
      timeId: TIME_CASA,
    });

    expect(partida.golsCasa).toBe(1);
    expect(partida.golsVisitante).toBe(0);
    expect(eventos[0]).toMatchObject({
      tipo: TipoEventoPartida.GOL_CONTRA,
      participanteId: VISITANTE,
      timeId: TIME_CASA,
    });
  });

  it('recusa assistencia em gol contra', async () => {
    const { servico, eventos } = criarCenario();

    await expect(
      servico.registrar(DONO, PARTIDA, {
        tipo: TipoEventoPartida.GOL_CONTRA,
        participanteId: VISITANTE,
        participanteRelacionadoId: CASA,
        timeId: TIME_CASA,
      }),
    ).rejects.toMatchObject({
      codigo: 'GOL_CONTRA_SEM_ASSISTENCIA',
    });
    expect(eventos).toHaveLength(0);
  });

  it('registra bola cheia durante a partida sem mudar o placar', async () => {
    const { servico, partida, eventos } = criarCenario();

    await servico.registrar(DONO, PARTIDA, {
      tipo: TipoEventoPartida.BOLA_CHEIA,
      participanteId: CASA,
      timeId: TIME_CASA,
    });

    expect(eventos[0]).toMatchObject({
      tipo: TipoEventoPartida.BOLA_CHEIA,
      participanteId: CASA,
    });
    expect(partida.golsCasa).toBe(0);
    expect(partida.golsVisitante).toBe(0);
  });

  it('recusa evento antes de a partida comecar', async () => {
    const { servico, eventos } = criarCenario({
      status: StatusPartida.AGUARDANDO,
    });

    await expect(
      servico.registrar(DONO, PARTIDA, {
        tipo: TipoEventoPartida.BOLA_MURCHA,
        participanteId: CASA,
        timeId: TIME_CASA,
      }),
    ).rejects.toMatchObject({
      codigo: 'PARTIDA_NAO_EM_ANDAMENTO',
    });
    expect(eventos).toHaveLength(0);
  });

  it('recusa time que nao participa da partida', async () => {
    const { servico, eventos } = criarCenario();

    await expect(
      servico.registrar(DONO, PARTIDA, {
        tipo: TipoEventoPartida.GOL,
        participanteId: CASA,
        timeId: 'time-inexistente',
      }),
    ).rejects.toMatchObject({
      codigo: 'TIME_FORA_PARTIDA',
    });
    expect(eventos).toHaveLength(0);
  });

  it('recusa gol normal atribuido a jogador adversario', async () => {
    const { servico, eventos } = criarCenario();

    await expect(
      servico.registrar(DONO, PARTIDA, {
        tipo: TipoEventoPartida.GOL,
        participanteId: VISITANTE,
        timeId: TIME_CASA,
      }),
    ).rejects.toMatchObject({
      codigo: 'AUTOR_GOL_TIME_INVALIDO',
    });
    expect(eventos).toHaveLength(0);
  });

  it('recusa gol contra atribuido a jogador do time beneficiado', async () => {
    const { servico, eventos } = criarCenario();

    await expect(
      servico.registrar(DONO, PARTIDA, {
        tipo: TipoEventoPartida.GOL_CONTRA,
        participanteId: CASA,
        timeId: TIME_CASA,
      }),
    ).rejects.toMatchObject({
      codigo: 'AUTOR_GOL_CONTRA_TIME_INVALIDO',
    });
    expect(eventos).toHaveLength(0);
  });

  it('recusa destaque atribuido ao time diferente do jogador', async () => {
    const { servico, eventos } = criarCenario();

    await expect(
      servico.registrar(DONO, PARTIDA, {
        tipo: TipoEventoPartida.BOLA_CHEIA,
        participanteId: VISITANTE,
        timeId: TIME_CASA,
      }),
    ).rejects.toMatchObject({
      codigo: 'PARTICIPANTE_TIME_INVALIDO',
    });
    expect(eventos).toHaveLength(0);
  });

  it('recusa assistencia de jogador adversario', async () => {
    const { servico, eventos } = criarCenario();

    await expect(
      servico.registrar(DONO, PARTIDA, {
        tipo: TipoEventoPartida.GOL,
        participanteId: CASA,
        participanteRelacionadoId: VISITANTE,
        timeId: TIME_CASA,
      }),
    ).rejects.toMatchObject({
      codigo: 'ASSISTENTE_TIME_INVALIDO',
    });
    expect(eventos).toHaveLength(0);
  });
});
