import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { ParticipantesService } from './participantes.service';

const DONO = 'usuario-1';
const PELADA = 'pelada-1';
const PARTICIPANTE = 'p1';
const SUBSTITUTO = 'p-substituto';

function criarServico(opcoes: {
  status?: StatusParticipantePelada;
  temTime?: boolean;
  partidaEmAndamento?: boolean;
  temSubstituto?: boolean;
  titularSemParticipacao?: boolean;
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
    update: jest.fn().mockResolvedValue({}),
  };
  const fila = {
    findOne: jest
      .fn()
      .mockImplementation((consulta: { where: { participanteId?: string } }) =>
        Promise.resolve(
          opcoes.temSubstituto && consulta.where.participanteId === SUBSTITUTO
            ? {
                id: 'fila-substituto',
                participanteId: SUBSTITUTO,
                posicao: 2,
                ativo: true,
              }
            : null,
        ),
      ),
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
      .mockImplementation((consulta: { where: Record<string, unknown> }) => {
        if ('substituiParticipanteId' in consulta.where) {
          return Promise.resolve(
            opcoes.temSubstituto
              ? {
                  id: 'jt-substituto',
                  participanteId: SUBSTITUTO,
                  timeId: 'time-casa',
                  ativo: true,
                }
              : null,
          );
        }
        return Promise.resolve(
          opcoes.temTime
            ? { id: 'jt1', timeId: 'time-casa', ativo: true }
            : null,
        );
      }),
    update: jest.fn().mockResolvedValue({}),
  };
  const partidas = {
    findOne: jest.fn().mockResolvedValue(
      opcoes.partidaEmAndamento
        ? {
            id: 'partida-1',
            timeCasaId: 'time-casa',
            timeVisitanteId: 'time-visitante',
          }
        : null,
    ),
  };
  const participacoes = {
    count: jest.fn().mockResolvedValue(0),
    findOne: jest.fn().mockResolvedValue(
      opcoes.titularSemParticipacao
        ? null
        : {
            id: 'pp-titular',
            partidaId: 'partida-1',
            participanteId: PARTICIPANTE,
          },
    ),
    create: jest.fn().mockImplementation((dados: unknown) => dados),
    save: jest
      .fn()
      .mockImplementation((dados: unknown) => Promise.resolve(dados)),
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
    partidas as never,
    participacoes as never,
    {} as never,
  );

  return {
    servico,
    participantes,
    fila,
    jogadoresTime,
    partidas,
    participacoes,
  };
}

describe('Pausa e desistência', () => {
  describe('pausar', () => {
    it('fecha a participacao sem perder a vaga nem mexer na fila', async () => {
      const { servico, jogadoresTime, fila, participacoes } = criarServico({
        temTime: true,
        partidaEmAndamento: true,
      });

      const p = await servico.pausar(DONO, PELADA, PARTICIPANTE);

      expect(p.status).toBe(StatusParticipantePelada.DESCANSANDO);
      // Sai da partida atual, mas continua ocupando a vaga na prancheta.
      expect(participacoes.update).toHaveBeenCalledWith(
        expect.objectContaining({
          partidaId: 'partida-1',
          participanteId: PARTICIPANTE,
        }),
        expect.objectContaining({ saiuEm: expect.any(Date) }),
      );
      expect(jogadoresTime.update).not.toHaveBeenCalled();
      // A fila fica intacta — e o que separa pausa de desistencia.
      expect(fila.update).not.toHaveBeenCalled();
      expect(fila.save).not.toHaveBeenCalled();
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
    it('volta ao mesmo time e reabre a participacao da partida atual', async () => {
      const { servico, fila, participacoes } = criarServico({
        status: StatusParticipantePelada.DESCANSANDO,
        temTime: true,
        partidaEmAndamento: true,
      });

      const p = await servico.retornar(DONO, PELADA, PARTICIPANTE);

      expect(p.status).toBe(StatusParticipantePelada.JOGANDO);
      expect(participacoes.update).toHaveBeenCalledWith(
        {
          partidaId: 'partida-1',
          participanteId: PARTICIPANTE,
        },
        { saiuEm: null },
      );
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

    it('retoma a vaga sem alterar a posicao do substituto na fila', async () => {
      const { servico, fila, jogadoresTime, participacoes, participantes } =
        criarServico({
          status: StatusParticipantePelada.DESCANSANDO,
          temTime: true,
          temSubstituto: true,
          partidaEmAndamento: true,
        });

      await servico.retornar(DONO, PELADA, PARTICIPANTE);

      expect(jogadoresTime.update).toHaveBeenCalledWith(
        'jt-substituto',
        expect.objectContaining({ ativo: false }),
      );
      expect(participacoes.update).toHaveBeenCalledWith(
        expect.objectContaining({
          partidaId: 'partida-1',
          participanteId: SUBSTITUTO,
        }),
        expect.objectContaining({ saiuEm: expect.any(Date) }),
      );
      expect(participantes.update).toHaveBeenCalledWith(SUBSTITUTO, {
        status: StatusParticipantePelada.PRESENTE,
      });
      expect(fila.update).not.toHaveBeenCalledWith(
        'fila-substituto',
        expect.anything(),
      );
      expect(fila.save).not.toHaveBeenCalled();
    });

    it('cria a participacao ao voltar no meio do jogo seguinte', async () => {
      const { servico, participacoes } = criarServico({
        status: StatusParticipantePelada.DESCANSANDO,
        temTime: true,
        temSubstituto: true,
        partidaEmAndamento: true,
        titularSemParticipacao: true,
      });

      await servico.retornar(DONO, PELADA, PARTICIPANTE);

      expect(participacoes.save).toHaveBeenCalledWith(
        expect.objectContaining({
          partidaId: 'partida-1',
          participanteId: PARTICIPANTE,
          timeId: 'time-casa',
          saiuEm: null,
        }),
      );
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
