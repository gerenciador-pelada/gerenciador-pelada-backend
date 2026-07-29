import { NotFoundException } from '@nestjs/common';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { PartidasService } from './partidas.service';

const DONO = 'usuario-1';
const INTRUSO = 'usuario-2';
const PARTIDA = 'partida-1';

/**
 * O construtor de consulta e mockado para devolver a partida apenas quando o
 * organizador informado for o dono. E assim que o servico funciona de verdade:
 * a posse entra no WHERE, entao a partida "some" para quem nao e dono.
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
    getOne: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          usuarioConsultado === donoDaPartida
            ? { id: PARTIDA, peladaId: 'pelada-1', status }
            : null,
        ),
      ),
  };

  return {
    repositorio: { createQueryBuilder: () => construtor, save },
    save,
  };
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
        const servico = new PartidasService(repositorio as never);

        await expect(servico[metodo](INTRUSO, PARTIDA)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(save).not.toHaveBeenCalled();
      },
    );
  });

  describe('com o organizador dono da partida', () => {
    it('inicia uma partida aguardando', async () => {
      const { repositorio } = criarRepositorio(DONO, StatusPartida.AGUARDANDO);
      const servico = new PartidasService(repositorio as never);

      const partida = await servico.iniciar(DONO, PARTIDA);

      expect(partida.status).toBe(StatusPartida.EM_ANDAMENTO);
      expect(partida.iniciadaEm).toBeInstanceOf(Date);
    });

    it('finaliza uma partida em andamento', async () => {
      const { repositorio } = criarRepositorio(
        DONO,
        StatusPartida.EM_ANDAMENTO,
      );
      const servico = new PartidasService(repositorio as never);

      const partida = await servico.finalizar(DONO, PARTIDA);

      expect(partida.status).toBe(StatusPartida.FINALIZADA);
      expect(partida.finalizadaEm).toBeInstanceOf(Date);
    });

    it('recusa iniciar partida que nao esta aguardando', async () => {
      const { repositorio } = criarRepositorio(
        DONO,
        StatusPartida.EM_ANDAMENTO,
      );
      const servico = new PartidasService(repositorio as never);

      await expect(servico.iniciar(DONO, PARTIDA)).rejects.toThrow(
        'Partida nao pode iniciar',
      );
    });
  });
});
