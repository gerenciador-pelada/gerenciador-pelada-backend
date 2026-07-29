import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { PartidasService } from './partidas.service';

const DONO = 'usuario-1';
const INTRUSO = 'usuario-2';
const PARTIDA = 'partida-1';

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
});
