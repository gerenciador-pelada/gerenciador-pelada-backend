import { RegraEmpate } from '../../comum/enums/regra-empate.enum';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { PainelService } from './painel.service';

const DONO = 'usuario-1';
const PELADA = 'pelada-1';
const PARTIDA = 'partida-4';
const CASA = 'time-casa';
const VISITANTE = 'time-visitante';

describe('PainelService', () => {
  it('mostra o goleiro avulso no time e preserva a mesma pessoa na fila', async () => {
    const partida = {
      id: PARTIDA,
      peladaId: PELADA,
      numero: 4,
      status: StatusPartida.EM_ANDAMENTO,
      golsCasa: 0,
      golsVisitante: 0,
      vencedorDecisao: null,
      timeCasaId: CASA,
      timeVisitanteId: VISITANTE,
      goleiroCasaId: 'goleiro-fila',
      goleiroVisitanteId: null,
      iniciadaEm: new Date('2026-07-30T21:00:00Z'),
      finalizadaEm: null,
    };
    const participantes = [
      {
        id: 'participante-a',
        ordemChegada: 1,
        ehGoleiroFixo: false,
        jogador: { nome: 'Ana', apelido: null },
      },
      {
        id: 'participante-b',
        ordemChegada: 2,
        ehGoleiroFixo: false,
        jogador: { nome: 'Bia', apelido: null },
      },
      {
        id: 'goleiro-fila',
        ordemChegada: 3,
        ehGoleiroFixo: false,
        jogador: { nome: 'Caio', apelido: 'Caião' },
      },
    ];
    const servico = new PainelService(
      {
        findOne: jest.fn().mockResolvedValue({
          id: PELADA,
          nome: 'Pelada',
          status: StatusPelada.EM_ANDAMENTO,
          local: null,
          configuracao: {
            jogadoresLinhaPorTime: 1,
            duracaoPartidaMinutos: 10,
            maximoGols: null,
            permiteEmpate: true,
            regraEmpate: RegraEmpate.AMBOS_SAEM,
          },
        }),
      } as never,
      { findOne: jest.fn().mockResolvedValue(partida) } as never,
      {
        find: jest.fn().mockResolvedValue([
          { id: CASA, nome: 'Casa', cor: null, vitoriasConsecutivas: 0 },
          {
            id: VISITANTE,
            nome: 'Visitante',
            cor: null,
            vitoriasConsecutivas: 0,
          },
        ]),
      } as never,
      {
        find: jest.fn().mockResolvedValue([
          {
            timeId: CASA,
            participanteId: 'participante-a',
            ehGoleiro: false,
          },
          {
            timeId: VISITANTE,
            participanteId: 'participante-b',
            ehGoleiro: false,
          },
        ]),
      } as never,
      { find: jest.fn().mockResolvedValue(participantes) } as never,
      {
        find: jest.fn().mockResolvedValue([
          {
            peladaId: PELADA,
            participanteId: 'goleiro-fila',
            posicao: 1,
            ativo: true,
          },
        ]),
      } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {
        createQueryBuilder: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      } as never,
    );

    const resultado = await servico.montar(DONO, PELADA);

    expect(resultado.timeCasa?.jogadores).toContainEqual(
      expect.objectContaining({
        participanteId: 'goleiro-fila',
        ehGoleiro: true,
        ehGoleiroTemporario: true,
      }),
    );
    expect(resultado.fila).toContainEqual(
      expect.objectContaining({
        participanteId: 'goleiro-fila',
        ehGoleiro: false,
      }),
    );
  });

  it('mostra configuracao e ultima partida quando a pelada esta finalizada', async () => {
    const ultimaPartida = {
      id: PARTIDA,
      peladaId: PELADA,
      numero: 4,
      status: StatusPartida.FINALIZADA,
      golsCasa: 2,
      golsVisitante: 2,
      vencedorDecisao: 'CASA',
      timeCasaId: CASA,
      timeVisitanteId: VISITANTE,
      iniciadaEm: new Date('2026-07-30T21:00:00Z'),
      finalizadaEm: new Date('2026-07-30T21:12:00Z'),
    };
    const peladas = {
      findOne: jest.fn().mockResolvedValue({
        id: PELADA,
        nome: 'Pelada de quinta',
        status: StatusPelada.FINALIZADA,
        local: { nome: 'Arena' },
        configuracao: {
          jogadoresLinhaPorTime: 5,
          duracaoPartidaMinutos: 10,
          maximoGols: null,
          permiteEmpate: false,
          regraEmpate: RegraEmpate.DECISAO_IMEDIATA,
        },
      }),
    };
    const partidas = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(ultimaPartida),
    };
    const times = {
      find: jest.fn().mockResolvedValue([
        {
          id: CASA,
          nome: 'Time Azul',
          cor: '#1565c0',
          vitoriasConsecutivas: 1,
        },
        {
          id: VISITANTE,
          nome: 'Time Verde',
          cor: '#2e7d32',
          vitoriasConsecutivas: 0,
        },
      ]),
    };
    const elencos = {
      find: jest.fn().mockResolvedValue([
        {
          timeId: CASA,
          participanteId: 'participante-a',
          ehGoleiro: false,
        },
        {
          timeId: VISITANTE,
          participanteId: 'participante-b',
          ehGoleiro: false,
        },
      ]),
    };
    const participantes = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'participante-a',
          ordemChegada: 1,
          ehGoleiroFixo: false,
          jogador: { nome: 'Ana', apelido: null },
        },
        {
          id: 'participante-b',
          ordemChegada: 2,
          ehGoleiroFixo: false,
          jogador: { nome: 'Bia', apelido: null },
        },
      ]),
    };
    const fila = { find: jest.fn().mockResolvedValue([]) };
    const eventos = { find: jest.fn().mockResolvedValue([]) };
    const servico = new PainelService(
      peladas as never,
      partidas as never,
      times as never,
      elencos as never,
      participantes as never,
      fila as never,
      eventos as never,
      {
        createQueryBuilder: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      } as never,
    );

    const resultado = await servico.montar(DONO, PELADA);

    expect(resultado.pelada).toMatchObject({
      status: StatusPelada.FINALIZADA,
      permiteEmpate: false,
      regraEmpate: RegraEmpate.DECISAO_IMEDIATA,
    });
    expect(resultado.partidaAtual).toBeNull();
    expect(resultado.ultimaPartida).toMatchObject({
      id: PARTIDA,
      golsCasa: 2,
      golsVisitante: 2,
      vencedorDecisao: 'CASA',
    });
    expect(resultado.timeCasa?.id).toBe(CASA);
    expect(resultado.timeVisitante?.id).toBe(VISITANTE);
    expect(eventos.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { partidaId: PARTIDA } }),
    );
  });

  it('marca quem esta fora no time e separa apenas descansando sem vaga', async () => {
    const partida = {
      id: PARTIDA,
      peladaId: PELADA,
      numero: 4,
      status: StatusPartida.EM_ANDAMENTO,
      timeCasaId: CASA,
      timeVisitanteId: VISITANTE,
      golsCasa: 1,
      golsVisitante: 0,
      goleiroCasaId: null,
      goleiroVisitanteId: null,
    };
    const participantes = [
      {
        id: 'fora-com-vaga',
        status: StatusParticipantePelada.DESCANSANDO,
        ordemChegada: 1,
        ehGoleiroFixo: false,
        jogador: { nome: 'Ana', apelido: null },
      },
      {
        id: 'fora-sem-vaga',
        status: StatusParticipantePelada.DESCANSANDO,
        ordemChegada: 2,
        ehGoleiroFixo: false,
        jogador: { nome: 'Bia', apelido: null },
      },
      {
        id: 'substituto',
        status: StatusParticipantePelada.JOGANDO,
        ordemChegada: 3,
        ehGoleiroFixo: false,
        jogador: { nome: 'Caio', apelido: 'Cai' },
      },
    ];
    const servico = new PainelService(
      {
        findOne: jest.fn().mockResolvedValue({
          id: PELADA,
          nome: 'Pelada',
          status: StatusPelada.EM_ANDAMENTO,
          local: null,
          configuracao: {
            jogadoresLinhaPorTime: 1,
            duracaoPartidaMinutos: 10,
            maximoGols: null,
            permiteEmpate: true,
            regraEmpate: RegraEmpate.AMBOS_SAEM,
          },
        }),
      } as never,
      { findOne: jest.fn().mockResolvedValue(partida) } as never,
      {
        find: jest.fn().mockResolvedValue([
          { id: CASA, nome: 'Casa', cor: null, vitoriasConsecutivas: 1 },
          {
            id: VISITANTE,
            nome: 'Visitante',
            cor: null,
            vitoriasConsecutivas: 0,
          },
        ]),
      } as never,
      {
        find: jest.fn().mockResolvedValue([
          {
            timeId: CASA,
            participanteId: 'fora-com-vaga',
            ehGoleiro: false,
          },
          {
            timeId: CASA,
            participanteId: 'substituto',
            substituiParticipanteId: 'fora-com-vaga',
            ehGoleiro: false,
          },
        ]),
      } as never,
      { find: jest.fn().mockResolvedValue(participantes) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {
        createQueryBuilder: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      } as never,
    );

    const resultado = await servico.montar(DONO, PELADA);

    expect(resultado.timeCasa?.jogadores).toContainEqual(
      expect.objectContaining({
        participanteId: 'fora-com-vaga',
        descansando: true,
      }),
    );
    expect(resultado.descansando).toEqual([
      expect.objectContaining({
        participanteId: 'fora-sem-vaga',
        descansando: true,
      }),
    ]);
    expect(resultado.timeCasa?.jogadores).toContainEqual(
      expect.objectContaining({
        participanteId: 'substituto',
        substituiParticipanteId: 'fora-com-vaga',
        substituiNome: 'Ana',
      }),
    );
  });

  /**
   * Incidente real: o organizador tirou alguem da fila e a pessoa sumiu da
   * tela. Ela continua PRESENTE — sem time, sem fila —, e o painel nao a
   * devolvia em lista nenhuma. Reaparecia so dentro do sheet de editar a fila,
   * embaixo de um divisor; fora dali a unica saida era tira-la da pelada de
   * vez, so para poder readiciona-la.
   */
  describe('quem foi tirado da fila', () => {
    const PARTIDA_EM_CURSO = {
      id: PARTIDA,
      peladaId: PELADA,
      numero: 1,
      status: StatusPartida.EM_ANDAMENTO,
      timeCasaId: CASA,
      timeVisitanteId: VISITANTE,
      golsCasa: 0,
      golsVisitante: 0,
      goleiroCasaId: null,
      goleiroVisitanteId: null,
    };

    function montarServico({
      participantes,
      fila = [],
      elencos = [],
      partida = PARTIDA_EM_CURSO as unknown,
    }: {
      participantes: unknown[];
      fila?: unknown[];
      elencos?: unknown[];
      partida?: unknown;
    }) {
      return new PainelService(
        {
          findOne: jest.fn().mockResolvedValue({
            id: PELADA,
            nome: 'Pelada',
            status: StatusPelada.EM_ANDAMENTO,
            local: null,
            configuracao: {
              jogadoresLinhaPorTime: 1,
              duracaoPartidaMinutos: 10,
              maximoGols: null,
              permiteEmpate: true,
              regraEmpate: RegraEmpate.AMBOS_SAEM,
            },
          }),
        } as never,
        { findOne: jest.fn().mockResolvedValue(partida) } as never,
        {
          find: jest.fn().mockResolvedValue([
            { id: CASA, nome: 'Casa', cor: null, vitoriasConsecutivas: 0 },
            {
              id: VISITANTE,
              nome: 'Visitante',
              cor: null,
              vitoriasConsecutivas: 0,
            },
          ]),
        } as never,
        { find: jest.fn().mockResolvedValue(elencos) } as never,
        { find: jest.fn().mockResolvedValue(participantes) } as never,
        { find: jest.fn().mockResolvedValue(fila) } as never,
        { find: jest.fn().mockResolvedValue([]) } as never,
        {
          createQueryBuilder: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
          }),
        } as never,
      );
    }

    const presente = (id: string, nome: string, extra = {}) => ({
      id,
      status: StatusParticipantePelada.PRESENTE,
      ordemChegada: 1,
      ehGoleiroFixo: false,
      jogador: { nome, apelido: null },
      ...extra,
    });

    it('continua visivel para ser posto na fila de novo', async () => {
      const servico = montarServico({
        participantes: [
          presente('tirado-da-fila', 'Ana'),
          presente('na-fila', 'Bia'),
        ],
        fila: [
          { peladaId: PELADA, participanteId: 'na-fila', posicao: 1, ativo: true },
        ],
      });

      const resultado = await servico.montar(DONO, PELADA);

      expect(resultado.foraDaFila).toEqual([
        expect.objectContaining({ participanteId: 'tirado-da-fila' }),
      ]);
    });

    it('nao repete quem esta na fila nem quem esta em campo', async () => {
      const servico = montarServico({
        participantes: [presente('em-campo', 'Ana'), presente('na-fila', 'Bia')],
        fila: [
          { peladaId: PELADA, participanteId: 'na-fila', posicao: 1, ativo: true },
        ],
        elencos: [{ timeId: CASA, participanteId: 'em-campo', ehGoleiro: false }],
      });

      const resultado = await servico.montar(DONO, PELADA);

      expect(resultado.foraDaFila).toEqual([]);
    });

    /**
     * Antes do sorteio nao ha time nem fila, entao todo participante se
     * encaixaria na descricao de "fora" — e a pelada inteira apareceria em
     * "Fora por agora" antes de comecar. Quem ainda nao foi sorteado nao esta
     * de fora de nada: esta esperando comecar.
     */
    it('nao lista ninguem antes do sorteio', async () => {
      const servico = montarServico({
        participantes: [presente('a', 'Ana'), presente('b', 'Bia')],
        partida: null,
      });

      const resultado = await servico.montar(DONO, PELADA);

      expect(resultado.foraDaFila).toEqual([]);
    });

    // O servidor recusa goleiro fixo na fila. Oferecer o botao seria prometer
    // o que a proxima tela nega.
    it('deixa o goleiro fixo de fora', async () => {
      const servico = montarServico({
        participantes: [presente('goleiro', 'Ana', { ehGoleiroFixo: true })],
      });

      const resultado = await servico.montar(DONO, PELADA);

      expect(resultado.foraDaFila).toEqual([]);
    });

    // Quem desistiu sai da pelada; ele volta pela tela de chegada, nao por um
    // botao de fila que o servidor recusaria.
    it('deixa quem desistiu de fora', async () => {
      const servico = montarServico({
        participantes: [
          presente('saiu', 'Ana', {
            status: StatusParticipantePelada.DESISTIU,
          }),
        ],
      });

      const resultado = await servico.montar(DONO, PELADA);

      expect(resultado.foraDaFila).toEqual([]);
    });
  });
});
