import { DataSource, EntityManager } from 'typeorm';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { ParticipantesService } from './participantes.service';

const DONO = 'usuario-1';
const PELADA = 'pelada-1';
const PARTIDA = 'partida-1';
const TIME_CASA = 'time-casa';
const TIME_VISITANTE = 'time-visitante';
const ESPERANDO = 'participante-esperando';
const OUTRO_ESPERANDO = 'participante-outro';

interface OpcoesAmbiente {
  statusPartida?: StatusPartida;
  statusParticipante?: StatusParticipantePelada;
  goleiroCasaId?: string | null;
  goleiroVisitanteId?: string | null;
}

function criarAmbiente(opcoes: OpcoesAmbiente = {}) {
  const partida = Object.assign(new PartidaEntity(), {
    id: PARTIDA,
    peladaId: PELADA,
    numero: 1,
    timeCasaId: TIME_CASA,
    timeVisitanteId: TIME_VISITANTE,
    status: opcoes.statusPartida ?? StatusPartida.AGUARDANDO,
    goleiroCasaId: opcoes.goleiroCasaId ?? null,
    goleiroVisitanteId: opcoes.goleiroVisitanteId ?? null,
  });
  const participantes = [
    Object.assign(new ParticipantePeladaEntity(), {
      id: ESPERANDO,
      peladaId: PELADA,
      status: opcoes.statusParticipante ?? StatusParticipantePelada.PRESENTE,
      ordemChegada: 7,
    }),
    Object.assign(new ParticipantePeladaEntity(), {
      id: OUTRO_ESPERANDO,
      peladaId: PELADA,
      status: StatusParticipantePelada.PRESENTE,
      ordemChegada: 8,
    }),
    Object.assign(new ParticipantePeladaEntity(), {
      id: 'jogador-casa',
      peladaId: PELADA,
      status: StatusParticipantePelada.PRESENTE,
      ordemChegada: 1,
    }),
    Object.assign(new ParticipantePeladaEntity(), {
      id: 'jogador-visitante',
      peladaId: PELADA,
      status: StatusParticipantePelada.PRESENTE,
      ordemChegada: 2,
    }),
  ];
  const elenco = [
    Object.assign(new JogadorTimeEntity(), {
      id: 'jt-casa',
      timeId: TIME_CASA,
      participanteId: 'jogador-casa',
      ehGoleiro: false,
      ativo: true,
    }),
    Object.assign(new JogadorTimeEntity(), {
      id: 'jt-visitante',
      timeId: TIME_VISITANTE,
      participanteId: 'jogador-visitante',
      ehGoleiro: false,
      ativo: true,
    }),
  ];
  const participacoes: ParticipacaoPartidaEntity[] = [];
  const escritasNaFila: unknown[] = [];

  if (partida.status === StatusPartida.EM_ANDAMENTO && partida.goleiroCasaId) {
    participacoes.push(
      Object.assign(new ParticipacaoPartidaEntity(), {
        id: 'participacao-goleiro-casa',
        partidaId: PARTIDA,
        participanteId: partida.goleiroCasaId,
        timeId: TIME_CASA,
        ehGoleiro: true,
        saiuEm: null,
      }),
    );
  }

  const fila = {
    update: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const gerenciador = {
    findOne: jest.fn(
      (
        entidade: unknown,
        opcoesBusca: {
          where?: Record<string, unknown> | Record<string, unknown>[];
        } = {},
      ) => {
        const condicoes = Array.isArray(opcoesBusca.where)
          ? opcoesBusca.where
          : [opcoesBusca.where ?? {}];
        const onde = condicoes[0];
        if (entidade === PartidaEntity) return Promise.resolve(partida);
        if (entidade === ParticipantePeladaEntity) {
          return Promise.resolve(
            participantes.find((p) => p.id === onde.id) ?? null,
          );
        }
        if (entidade === JogadorTimeEntity) {
          return Promise.resolve(
            elenco.find((membro) =>
              condicoes.some(
                (condicao) =>
                  (condicao.timeId === undefined ||
                    membro.timeId === condicao.timeId) &&
                  (condicao.participanteId === undefined ||
                    membro.participanteId === condicao.participanteId) &&
                  (condicao.ehGoleiro === undefined ||
                    membro.ehGoleiro === condicao.ehGoleiro) &&
                  membro.ativo === true,
              ),
            ) ?? null,
          );
        }
        if (entidade === ParticipacaoPartidaEntity) {
          return Promise.resolve(
            participacoes.find(
              (participacao) =>
                participacao.partidaId === onde.partidaId &&
                participacao.participanteId === onde.participanteId &&
                participacao.saiuEm === null,
            ) ?? null,
          );
        }
        return Promise.resolve(null);
      },
    ),
    create: jest.fn((entidade: unknown, dados: object) => ({
      ...dados,
      ...(entidade === FilaJogadorEntity
        ? { entidadeTeste: FilaJogadorEntity }
        : {}),
    })),
    save: jest.fn((valor: object) => {
      if ('entidadeTeste' in valor) {
        escritasNaFila.push(valor);
        return Promise.resolve(valor);
      }
      if ('timeCasaId' in valor) return Promise.resolve(valor);
      if ('partidaId' in valor && 'participanteId' in valor) {
        const participacao = Object.assign(
          new ParticipacaoPartidaEntity(),
          valor,
          { id: `participacao-${participacoes.length + 1}` },
        );
        participacoes.push(participacao);
        return Promise.resolve(participacao);
      }
      return Promise.resolve(valor);
    }),
    update: jest.fn(
      (
        entidade: unknown,
        criterio: string | Record<string, unknown>,
        dados: Partial<ParticipacaoPartidaEntity>,
      ) => {
        if (entidade === FilaJogadorEntity) escritasNaFila.push(dados);
        if (entidade === ParticipacaoPartidaEntity) {
          const registro = participacoes.find((participacao) =>
            typeof criterio === 'string'
              ? participacao.id === criterio
              : participacao.partidaId === criterio.partidaId &&
                participacao.participanteId === criterio.participanteId,
          );
          if (registro) Object.assign(registro, dados);
        }
        return Promise.resolve({ affected: 1 });
      },
    ),
    delete: jest.fn((entidade: unknown, criterio: unknown) => {
      if (entidade === FilaJogadorEntity) escritasNaFila.push(criterio);
      return Promise.resolve({ affected: 1 });
    }),
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
    fila as never,
    {
      find: jest.fn().mockResolvedValue(elenco),
      findOne: jest.fn(),
      update: jest.fn(),
    } as never,
    { findOne: jest.fn() } as never,
    { findOne: jest.fn() } as never,
    {
      transaction: (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(gerenciador as unknown as EntityManager),
    } as unknown as DataSource,
  );

  return {
    servico,
    partida,
    participantes,
    elenco,
    participacoes,
    fila,
    escritasNaFila,
  };
}

describe('Goleiro avulso', () => {
  it('escolhe para o gol da casa quem esta fora da partida sem alterar a fila', async () => {
    const { servico, partida, fila, escritasNaFila } = criarAmbiente();

    await servico.definirGoleiro(DONO, PELADA, TIME_CASA, ESPERANDO);

    expect(partida.goleiroCasaId).toBe(ESPERANDO);
    expect(partida.goleiroVisitanteId).toBeNull();
    expect(fila.update).not.toHaveBeenCalled();
    expect(fila.save).not.toHaveBeenCalled();
    expect(fila.delete).not.toHaveBeenCalled();
    expect(escritasNaFila).toHaveLength(0);
  });

  it('recusa jogador que ja pertence a um dos times', async () => {
    const { servico } = criarAmbiente();

    await expect(
      servico.definirGoleiro(DONO, PELADA, TIME_CASA, 'jogador-visitante'),
    ).rejects.toMatchObject({ codigo: 'JOGADOR_JA_EM_CAMPO' });
  });

  it('recusa quem nao esta disponivel na pelada', async () => {
    const { servico } = criarAmbiente({
      statusParticipante: StatusParticipantePelada.DESCANSANDO,
    });

    await expect(
      servico.definirGoleiro(DONO, PELADA, TIME_CASA, ESPERANDO),
    ).rejects.toMatchObject({ codigo: 'GOLEIRO_INDISPONIVEL' });
  });

  it('nao deixa a mesma pessoa ocupar os dois gols', async () => {
    const { servico } = criarAmbiente({ goleiroVisitanteId: ESPERANDO });

    await expect(
      servico.definirGoleiro(DONO, PELADA, TIME_CASA, ESPERANDO),
    ).rejects.toMatchObject({ codigo: 'GOLEIRO_JA_ESCALADO' });
  });

  it('troca o goleiro durante a partida encerrando somente a participacao anterior', async () => {
    const { servico, partida, participacoes, fila, escritasNaFila } =
      criarAmbiente({
        statusPartida: StatusPartida.EM_ANDAMENTO,
        goleiroCasaId: ESPERANDO,
      });

    await servico.definirGoleiro(DONO, PELADA, TIME_CASA, OUTRO_ESPERANDO);

    expect(partida.goleiroCasaId).toBe(OUTRO_ESPERANDO);
    expect(
      participacoes.find((p) => p.participanteId === ESPERANDO)?.saiuEm,
    ).toBeInstanceOf(Date);
    expect(participacoes).toContainEqual(
      expect.objectContaining({
        participanteId: OUTRO_ESPERANDO,
        timeId: TIME_CASA,
        ehGoleiro: true,
        saiuEm: null,
      }),
    );
    expect(fila.update).not.toHaveBeenCalled();
    expect(escritasNaFila).toHaveLength(0);
  });

  it('remove o goleiro avulso sem tocar na fila', async () => {
    const { servico, partida, participacoes, fila } = criarAmbiente({
      statusPartida: StatusPartida.EM_ANDAMENTO,
      goleiroCasaId: ESPERANDO,
    });

    await servico.definirGoleiro(DONO, PELADA, TIME_CASA, null);

    expect(partida.goleiroCasaId).toBeNull();
    expect(participacoes[0].saiuEm).toBeInstanceOf(Date);
    expect(fila.update).not.toHaveBeenCalled();
  });

  it('expõe erros de regra, não erros genéricos', async () => {
    const { servico } = criarAmbiente({
      statusParticipante: StatusParticipantePelada.AUSENTE,
    });

    await expect(
      servico.definirGoleiro(DONO, PELADA, TIME_CASA, ESPERANDO),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
  });
});
