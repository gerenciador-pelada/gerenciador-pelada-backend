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
});
