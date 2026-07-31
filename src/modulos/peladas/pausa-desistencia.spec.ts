import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { ParticipantesService } from './participantes.service';

const DONO = 'usuario-1';
const PELADA = 'pelada-1';
const PARTICIPANTE = 'p1';

function criarServico(opcoes: {
  status?: StatusParticipantePelada;
  temTime?: boolean;
}) {
  const participante = {
    id: PARTICIPANTE,
    peladaId: PELADA,
    status: opcoes.status ?? StatusParticipantePelada.JOGANDO,
    ordemChegada: 1,
    ehGoleiroFixo: false,
  };

  const participantes = {
    findOne: jest.fn().mockResolvedValue(participante),
    save: jest.fn().mockImplementation((p: unknown) => Promise.resolve(p)),
  };
  const fila = {
    findOne: jest.fn().mockResolvedValue(null),
    // A desistencia compacta a fila depois de tirar quem saiu.
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((d: unknown) => d),
    save: jest.fn().mockImplementation((d: unknown) => Promise.resolve(d)),
    update: jest.fn().mockResolvedValue({}),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ maximo: '0' }),
    }),
  };
  const jogadoresTime = {
    findOne: jest
      .fn()
      .mockResolvedValue(opcoes.temTime ? { id: 'jt1', ativo: true } : null),
    update: jest.fn().mockResolvedValue({}),
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
    participantes as never,
    fila as never,
    jogadoresTime as never,
    { findOne: jest.fn().mockResolvedValue(null) } as never,
    { count: jest.fn().mockResolvedValue(0) } as never,
    {} as never,
  );

  return { servico, participantes, fila, jogadoresTime };
}

describe('Pausa e desistência', () => {
  describe('pausar', () => {
    it('sai de campo mas nao mexe na fila', async () => {
      const { servico, jogadoresTime, fila } = criarServico({ temTime: true });

      const p = await servico.pausar(DONO, PELADA, PARTICIPANTE);

      expect(p.status).toBe(StatusParticipantePelada.DESCANSANDO);
      // Sai do time: quem descansa nao esta jogando, e a vaga precisa
      // aparecer para o organizador por outro no lugar.
      expect(jogadoresTime.update).toHaveBeenCalledWith(
        { participanteId: PARTICIPANTE, ativo: true },
        expect.objectContaining({ ativo: false }),
      );
      // Mas a fila fica intacta — e o que separa pausa de desistencia.
      expect(fila.update).not.toHaveBeenCalled();
    });

    it('recusa pausar quem ja desistiu', async () => {
      const { servico } = criarServico({
        status: StatusParticipantePelada.DESISTIU,
      });

      await expect(
        servico.pausar(DONO, PELADA, PARTICIPANTE),
      ).rejects.toBeInstanceOf(ErroRegraPelada);
    });
  });

  describe('retornar', () => {
    it('volta a jogar quando a vaga no time foi guardada', async () => {
      const { servico, fila } = criarServico({
        status: StatusParticipantePelada.DESCANSANDO,
        temTime: true,
      });

      const p = await servico.retornar(DONO, PELADA, PARTICIPANTE);

      expect(p.status).toBe(StatusParticipantePelada.JOGANDO);
      expect(fila.save).not.toHaveBeenCalled();
    });

    it('entra na fila quando nao tem mais time', async () => {
      const { servico, fila } = criarServico({
        status: StatusParticipantePelada.DESCANSANDO,
        temTime: false,
      });

      const p = await servico.retornar(DONO, PELADA, PARTICIPANTE);

      expect(p.status).toBe(StatusParticipantePelada.PRESENTE);
      expect(fila.save).toHaveBeenCalled();
    });
  });

  describe('desistir', () => {
    it('libera a vaga no time e sai da fila', async () => {
      const { servico, jogadoresTime, fila } = criarServico({ temTime: true });

      const p = await servico.desistir(DONO, PELADA, PARTICIPANTE);

      expect(p.status).toBe(StatusParticipantePelada.DESISTIU);
      expect(jogadoresTime.update).toHaveBeenCalledWith(
        { participanteId: PARTICIPANTE, ativo: true },
        expect.objectContaining({ ativo: false }),
      );
      expect(fila.update).toHaveBeenCalledWith(
        { peladaId: PELADA, participanteId: PARTICIPANTE, ativo: true },
        expect.objectContaining({ ativo: false }),
      );
    });

    it('preserva o registro do participante', async () => {
      const { servico, participantes } = criarServico({ temTime: true });

      await servico.desistir(DONO, PELADA, PARTICIPANTE);

      // Nada e apagado: gols e pontos ja marcados continuam valendo.
      expect(participantes.save).toHaveBeenCalled();
    });

    it('sobe a lista: quem fica assume as posicoes 1..n sem buraco', async () => {
      const { servico, fila } = criarServico({ temTime: true });
      // Quem saiu ocupava a posicao 2; restam a 1, a 3 e a 4.
      fila.find.mockResolvedValueOnce([
        { id: 'f1', posicao: 1 },
        { id: 'f3', posicao: 3 },
        { id: 'f4', posicao: 4 },
      ]);

      await servico.desistir(DONO, PELADA, PARTICIPANTE);

      // A primeira ja esta certa e nao e tocada; as outras sobem uma.
      expect(fila.update).toHaveBeenCalledWith('f3', { posicao: 2 });
      expect(fila.update).toHaveBeenCalledWith('f4', { posicao: 3 });
      expect(fila.update).not.toHaveBeenCalledWith('f1', { posicao: 1 });
    });
  });
});
