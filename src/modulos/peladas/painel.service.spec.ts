import { RegraEmpate } from '../../comum/enums/regra-empate.enum';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { PainelService } from './painel.service';

const DONO = 'usuario-1';
const PELADA = 'pelada-1';
const PARTIDA = 'partida-4';
const CASA = 'time-casa';
const VISITANTE = 'time-visitante';

describe('PainelService', () => {
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
});
