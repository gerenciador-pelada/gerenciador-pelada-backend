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
    {} as never,
  );

  return { servico, participantes, fila, jogadoresTime };
}

describe('Pausa e desistência', () => {
  describe('pausar', () => {
    it('guarda a vaga no time', async () => {
      const { servico, jogadoresTime, fila } = criarServico({ temTime: true });

      const p = await servico.pausar(DONO, PELADA, PARTICIPANTE);

      expect(p.status).toBe(StatusParticipantePelada.DESCANSANDO);
      // A vaga fica guardada: nada e desativado no time nem na fila.
      expect(jogadoresTime.update).not.toHaveBeenCalled();
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
  });
});
