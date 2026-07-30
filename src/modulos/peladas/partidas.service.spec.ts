import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, UpdateResult } from 'typeorm';
import { ConfiguracaoPeladaEntity } from '../../banco/entidades/configuracao-pelada.entity';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { PontuacaoJogadorEntity } from '../../banco/entidades/pontuacao-jogador.entity';
import { RegraEmpate } from '../../comum/enums/regra-empate.enum';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { PartidasService } from './partidas.service';

const DONO = 'usuario-1';
const INTRUSO = 'usuario-2';
const PARTIDA = 'partida-1';
const PELADA = 'pelada-1';

/**
 * O construtor de consulta so devolve a partida quando o organizador informado
 * for o dono. E assim que o servico funciona de verdade: a posse entra no
 * WHERE, entao a partida "some" para quem nao e dono.
 */
function criarRepositorio(donoDaPartida: string, status: StatusPartida) {
  const save = jest.fn().mockImplementation((p: unknown) => Promise.resolve(p));
  let usuarioConsultado = '';

  const construtor = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockImplementation((_sql: string, params: unknown) => {
      const p = params as { usuarioId?: string };
      if (p?.usuarioId) usuarioConsultado = p.usuarioId;
      return construtor;
    }),
    getOne: jest.fn().mockImplementation(() =>
      Promise.resolve(
        usuarioConsultado === donoDaPartida
          ? {
              id: PARTIDA,
              peladaId: 'pelada-1',
              numero: 1,
              timeCasaId: 'time-a',
              timeVisitanteId: 'time-b',
              golsCasa: 0,
              golsVisitante: 0,
              status,
            }
          : null,
      ),
    ),
  };

  return { repositorio: { createQueryBuilder: () => construtor, save }, save };
}

/** DataSource cujo `transaction` apenas executa o callback com o manager dado. */
function criarFonteDados(gerenciador: Partial<EntityManager>): DataSource {
  return {
    transaction: (cb: (m: EntityManager) => Promise<unknown>) =>
      cb(gerenciador as EntityManager),
  } as unknown as DataSource;
}

interface OpcoesCenarioFinalizacao {
  statusPelada?: StatusPelada;
  permiteEmpate?: boolean;
  regraEmpate?: RegraEmpate;
  partida?: PartidaEntity | null;
  partidasAguardando?: number;
  usuarioAutorizado?: boolean;
}

function criarPartida(golsCasa = 2, golsVisitante = 1): PartidaEntity {
  return {
    id: PARTIDA,
    peladaId: PELADA,
    numero: 1,
    timeCasaId: 'time-a',
    timeVisitanteId: 'time-b',
    golsCasa,
    golsVisitante,
    status: StatusPartida.EM_ANDAMENTO,
    iniciadaEm: new Date('2026-07-30T21:00:00Z'),
    finalizadaEm: null,
    vencedorDecisao: null,
    criadoEm: new Date('2026-07-30T21:00:00Z'),
    atualizadoEm: new Date('2026-07-30T21:00:00Z'),
  };
}

function criarCenarioFinalizacao({
  statusPelada = StatusPelada.EM_ANDAMENTO,
  permiteEmpate = true,
  regraEmpate = RegraEmpate.AMBOS_SAEM,
  partida = criarPartida(),
  partidasAguardando = 0,
  usuarioAutorizado = true,
}: OpcoesCenarioFinalizacao = {}) {
  const configuracao = {
    permiteEmpate,
    regraEmpate,
    pontosVitoria: 3,
    pontosEmpate: 1,
    pontosDerrota: 0,
    pontosGol: 0,
    pontosAssistencia: 0,
    pontosBolaCheia: 0,
    pontosBolaMurcha: 0,
  } as ConfiguracaoPeladaEntity;
  const pelada = {
    id: PELADA,
    organizadorId: DONO,
    status: statusPelada,
    configuracao,
  } as PeladaEntity;

  const pontuacoes: PontuacaoJogadorEntity[] = [];
  const salvos: unknown[] = [];
  const gerenciador = {
    findOne: jest
      .fn()
      .mockImplementation(
        (
          entidade: typeof PeladaEntity | typeof PartidaEntity,
          opcoes: { where?: { status?: StatusPartida } },
        ) => {
          if (entidade === PeladaEntity) {
            return Promise.resolve(usuarioAutorizado ? pelada : null);
          }
          if (entidade === ConfiguracaoPeladaEntity) {
            return Promise.resolve(configuracao);
          }
          if (opcoes.where?.status === StatusPartida.EM_ANDAMENTO) {
            return Promise.resolve(partida);
          }
          if (opcoes.where?.status === StatusPartida.FINALIZADA) {
            return Promise.resolve(
              partida?.status === StatusPartida.FINALIZADA ? partida : null,
            );
          }
          return Promise.resolve(null);
        },
      ),
    find: jest.fn().mockImplementation((entidade: new () => unknown) => {
      if (!partida) return Promise.resolve([]);
      if (entidade === ParticipacaoPartidaEntity) {
        return Promise.resolve([
          {
            partidaId: partida.id,
            participanteId: 'participante-a',
            timeId: partida.timeCasaId,
          },
          {
            partidaId: partida.id,
            participanteId: 'participante-b',
            timeId: partida.timeVisitanteId,
          },
        ]);
      }
      if (entidade === ParticipantePeladaEntity) {
        return Promise.resolve([
          { id: 'participante-a', jogadorId: 'jogador-a' },
          { id: 'participante-b', jogadorId: 'jogador-b' },
        ]);
      }
      if (entidade === EventoPartidaEntity) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
    create: jest
      .fn()
      .mockImplementation(
        (_entidade: new () => unknown, dados: Record<string, unknown>) => dados,
      ),
    save: jest.fn().mockImplementation((dados: unknown) => {
      salvos.push(dados);
      if (
        Array.isArray(dados) &&
        dados.every(
          (item) =>
            typeof item === 'object' && item !== null && 'pontosTotal' in item,
        )
      ) {
        pontuacoes.push(...(dados as PontuacaoJogadorEntity[]));
      }
      return Promise.resolve(dados);
    }),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    update: jest.fn().mockResolvedValue({
      affected: partidasAguardando,
      raw: [],
      generatedMaps: [],
    } satisfies UpdateResult),
  };
  const servico = new PartidasService(
    {} as never,
    criarFonteDados(gerenciador),
  );

  return { servico, gerenciador, pelada, partida, pontuacoes, salvos };
}

describe('PartidasService', () => {
  describe('isolamento entre organizadores', () => {
    it.each(['iniciar', 'finalizar', 'cancelar'] as const)(
      '%s recusa partida de outro organizador com 404',
      async (metodo) => {
        const { repositorio, save } = criarRepositorio(
          DONO,
          StatusPartida.AGUARDANDO,
        );
        const servico = new PartidasService(
          repositorio as never,
          criarFonteDados({}),
        );

        await expect(servico[metodo](INTRUSO, PARTIDA)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(save).not.toHaveBeenCalled();
      },
    );
  });

  describe('iniciar', () => {
    it('cria uma participacao para cada jogador dos dois times', async () => {
      const { repositorio } = criarRepositorio(DONO, StatusPartida.AGUARDANDO);
      const salvos: unknown[] = [];
      const gerenciador = {
        find: jest.fn().mockResolvedValue([
          { timeId: 'time-a', participanteId: 'p1', ehGoleiro: false },
          { timeId: 'time-a', participanteId: 'p2', ehGoleiro: true },
          { timeId: 'time-b', participanteId: 'p3', ehGoleiro: false },
        ] as Partial<JogadorTimeEntity>[]),
        create: jest.fn().mockImplementation((_e, dados: unknown) => dados),
        save: jest.fn().mockImplementation((d: unknown) => {
          salvos.push(d);
          return Promise.resolve(d);
        }),
      };
      const servico = new PartidasService(
        repositorio as never,
        criarFonteDados(gerenciador),
      );

      const partida = await servico.iniciar(DONO, PARTIDA);

      const participacoes = salvos[0] as ParticipacaoPartidaEntity[];
      expect(participacoes).toHaveLength(3);
      expect(participacoes.map((p) => p.participanteId)).toEqual([
        'p1',
        'p2',
        'p3',
      ]);
      expect(
        participacoes.find((p) => p.participanteId === 'p2')?.ehGoleiro,
      ).toBe(true);
      expect(partida.status).toBe(StatusPartida.EM_ANDAMENTO);
      expect(partida.iniciadaEm).toBeInstanceOf(Date);
    });

    it('recusa iniciar partida que nao esta aguardando', async () => {
      const { repositorio } = criarRepositorio(
        DONO,
        StatusPartida.EM_ANDAMENTO,
      );
      const servico = new PartidasService(
        repositorio as never,
        criarFonteDados({}),
      );

      await expect(servico.iniciar(DONO, PARTIDA)).rejects.toThrow(
        'Partida nao pode iniciar',
      );
    });
  });

  describe('finalizar', () => {
    it('recusa finalizar partida que nao esta em andamento', async () => {
      const { repositorio } = criarRepositorio(DONO, StatusPartida.AGUARDANDO);
      const servico = new PartidasService(
        repositorio as never,
        criarFonteDados({}),
      );

      await expect(servico.finalizar(DONO, PARTIDA)).rejects.toThrow(
        'Partida nao esta em andamento',
      );
    });

    it('recusa empate quando a pelada nao permite', async () => {
      const { repositorio } = criarRepositorio(
        DONO,
        StatusPartida.EM_ANDAMENTO,
      );
      const gerenciador = {
        findOne: jest.fn().mockResolvedValue({
          id: 'pelada-1',
          configuracao: { permiteEmpate: false, jogadoresLinhaPorTime: 5 },
        }),
      };
      const servico = new PartidasService(
        repositorio as never,
        criarFonteDados(gerenciador),
      );

      // golsCasa e golsVisitante sao 0 x 0 no repositorio de teste
      await expect(servico.finalizar(DONO, PARTIDA)).rejects.toThrow(
        'Esta pelada nao permite empate',
      );
    });
  });

  describe('finalizarPelada', () => {
    it('finaliza a partida pelo placar, pontua e nao cria outro confronto', async () => {
      const { servico, gerenciador, partida, pelada, pontuacoes } =
        criarCenarioFinalizacao({
          partida: criarPartida(2, 1),
          partidasAguardando: 1,
        });

      const resultado = await servico.finalizarPelada(DONO, PELADA);

      expect(resultado).toEqual({
        peladaId: PELADA,
        status: StatusPelada.FINALIZADA,
        partidaFinalizada: {
          id: PARTIDA,
          golsCasa: 2,
          golsVisitante: 1,
          vencedorDecisao: null,
        },
        partidasCanceladas: 1,
        jaEstavaFinalizada: false,
      });
      expect(partida?.status).toBe(StatusPartida.FINALIZADA);
      expect(partida?.finalizadaEm).toBeInstanceOf(Date);
      expect(pelada.status).toBe(StatusPelada.FINALIZADA);
      expect(pontuacoes.map((p) => p.pontosVitoria)).toEqual([3, 0]);
      expect(gerenciador.update).toHaveBeenCalledWith(
        PartidaEntity,
        { peladaId: PELADA, status: StatusPartida.AGUARDANDO },
        { status: StatusPartida.CANCELADA },
      );
      expect(
        gerenciador.create.mock.calls.some(
          ([entidade]) => entidade === PartidaEntity,
        ),
      ).toBe(false);
    });

    it('preserva empate permitido e da os pontos de empate aos dois times', async () => {
      const { servico, partida, pontuacoes } = criarCenarioFinalizacao({
        partida: criarPartida(1, 1),
        permiteEmpate: true,
        regraEmpate: RegraEmpate.AMBOS_SAEM,
      });

      const resultado = await servico.finalizarPelada(DONO, PELADA);

      expect(resultado.partidaFinalizada?.vencedorDecisao).toBeNull();
      expect(partida?.golsCasa).toBe(1);
      expect(partida?.golsVisitante).toBe(1);
      expect(pontuacoes.map((p) => p.pontosVitoria)).toEqual([1, 1]);
    });

    it.each([
      {
        permiteEmpate: false,
        regraEmpate: RegraEmpate.AMBOS_SAEM,
      },
      {
        permiteEmpate: true,
        regraEmpate: RegraEmpate.DECISAO_IMEDIATA,
      },
    ])(
      'recusa empate sem vencedor com permiteEmpate=$permiteEmpate e regra=$regraEmpate',
      async ({ permiteEmpate, regraEmpate }) => {
        const { servico, gerenciador, pelada } = criarCenarioFinalizacao({
          partida: criarPartida(0, 0),
          permiteEmpate,
          regraEmpate,
        });

        await expect(
          servico.finalizarPelada(DONO, PELADA),
        ).rejects.toMatchObject<Partial<ErroRegraPelada>>({
          codigo: 'VENCEDOR_FINAL_OBRIGATORIO',
        });
        expect(pelada.status).toBe(StatusPelada.EM_ANDAMENTO);
        expect(gerenciador.save).not.toHaveBeenCalled();
      },
    );

    it('registra vencedor por decisao sem alterar o placar empatado', async () => {
      const { servico, partida, pontuacoes } = criarCenarioFinalizacao({
        partida: criarPartida(2, 2),
        permiteEmpate: false,
      });

      const resultado = await servico.finalizarPelada(DONO, PELADA, {
        vencedorDecisao: 'VISITANTE',
      });

      expect(partida).toMatchObject({
        golsCasa: 2,
        golsVisitante: 2,
        vencedorDecisao: 'VISITANTE',
      });
      expect(resultado.partidaFinalizada?.vencedorDecisao).toBe('VISITANTE');
      expect(pontuacoes.map((p) => p.pontosVitoria)).toEqual([0, 3]);
    });

    it('cancela confronto aguardando sem gerar pontuacao', async () => {
      const { servico, gerenciador, pontuacoes } = criarCenarioFinalizacao({
        partida: null,
        partidasAguardando: 1,
      });

      const resultado = await servico.finalizarPelada(DONO, PELADA);

      expect(resultado.partidaFinalizada).toBeNull();
      expect(resultado.partidasCanceladas).toBe(1);
      expect(pontuacoes).toHaveLength(0);
      expect(gerenciador.delete).not.toHaveBeenCalled();
    });

    it('finaliza mesmo sem uma partida atual', async () => {
      const { servico } = criarCenarioFinalizacao({
        partida: null,
        partidasAguardando: 0,
      });

      await expect(
        servico.finalizarPelada(DONO, PELADA),
      ).resolves.toMatchObject({
        status: StatusPelada.FINALIZADA,
        partidaFinalizada: null,
        partidasCanceladas: 0,
      });
    });

    it('repete com seguranca uma finalizacao ja concluida', async () => {
      const finalizada = criarPartida(3, 2);
      finalizada.status = StatusPartida.FINALIZADA;
      finalizada.finalizadaEm = new Date('2026-07-30T21:15:00Z');
      const { servico, gerenciador } = criarCenarioFinalizacao({
        statusPelada: StatusPelada.FINALIZADA,
        partida: finalizada,
      });

      const resultado = await servico.finalizarPelada(DONO, PELADA);

      expect(resultado).toMatchObject({
        jaEstavaFinalizada: true,
        partidaFinalizada: { id: PARTIDA, golsCasa: 3, golsVisitante: 2 },
      });
      expect(gerenciador.delete).not.toHaveBeenCalled();
      expect(gerenciador.update).not.toHaveBeenCalled();
      expect(gerenciador.save).not.toHaveBeenCalled();
    });

    it('nao revela a pelada de outro organizador e solicita lock de escrita', async () => {
      const cenarioAutorizado = criarCenarioFinalizacao();

      await cenarioAutorizado.servico.finalizarPelada(DONO, PELADA);

      expect(cenarioAutorizado.gerenciador.findOne).toHaveBeenCalledWith(
        PeladaEntity,
        expect.objectContaining({
          where: { id: PELADA, organizadorId: DONO },
          lock: { mode: 'pessimistic_write' },
        }),
      );

      const cenarioIntruso = criarCenarioFinalizacao({
        usuarioAutorizado: false,
      });
      await expect(
        cenarioIntruso.servico.finalizarPelada(INTRUSO, PELADA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('nao converte uma pelada cancelada em finalizada', async () => {
      const { servico, gerenciador } = criarCenarioFinalizacao({
        statusPelada: StatusPelada.CANCELADA,
      });

      await expect(servico.finalizarPelada(DONO, PELADA)).rejects.toMatchObject<
        Partial<ErroRegraPelada>
      >({
        codigo: 'TRANSICAO_STATUS_INVALIDA',
      });
      expect(gerenciador.save).not.toHaveBeenCalled();
    });
  });
});
