import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { TimeEntity } from '../../banco/entidades/time.entity';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { PartidasDaPeladaService } from './partidas-da-pelada.service';

const repo = <T>(dados: T[]) =>
  ({
    find: jest.fn().mockResolvedValue(dados),
    findOne: jest.fn().mockResolvedValue(dados[0] ?? null),
  }) as unknown as Repository<T & object>;

function montar(sobrescrever: { eventos?: EventoPartidaEntity[] } = {}) {
  const pelada = {
    id: 'pelada-1',
    nome: 'Pelada de quinta',
    status: 'EM_ANDAMENTO',
  } as unknown as PeladaEntity;

  const partidas = [
    {
      id: 'partida-1',
      numero: 1,
      status: StatusPartida.FINALIZADA,
      golsCasa: 2,
      golsVisitante: 1,
      timeCasaId: 'time-a',
      timeVisitanteId: 'time-b',
      iniciadaEm: null,
      finalizadaEm: null,
    },
  ] as unknown as PartidaEntity[];

  const participantes = [
    { id: 'p-ana', jogador: { nome: 'Ana', apelido: null } },
    { id: 'p-bia', jogador: { nome: 'Beatriz', apelido: 'Bia' } },
    { id: 'p-caio', jogador: { nome: 'Caio', apelido: null } },
  ] as unknown as ParticipantePeladaEntity[];

  const eventos =
    sobrescrever.eventos ??
    ([
      {
        id: 'ev-1',
        partidaId: 'partida-1',
        tipo: TipoEventoPartida.GOL,
        timeId: 'time-a',
        participanteId: 'p-ana',
        participanteRelacionadoId: 'p-bia',
      },
    ] as unknown as EventoPartidaEntity[]);

  const servico = new PartidasDaPeladaService(
    repo([pelada]),
    repo(partidas),
    repo([
      { id: 'time-a', nome: 'Time A', cor: '#3B82F6' },
      { id: 'time-b', nome: 'Time B', cor: '#22C55E' },
    ] as unknown as TimeEntity[]),
    repo([
      { timeId: 'time-a', participanteId: 'p-ana' },
      { timeId: 'time-a', participanteId: 'p-bia' },
      { timeId: 'time-b', participanteId: 'p-caio' },
    ] as unknown as JogadorTimeEntity[]),
    repo(participantes),
    repo(eventos),
  );

  return { servico };
}

describe('PartidasDaPeladaService', () => {
  it('traz cada partida com autor e assistente pelo nome', async () => {
    const { servico } = montar();

    const { partidas } = await servico.listar('usuario-1', 'pelada-1');

    expect(partidas).toHaveLength(1);
    expect(partidas[0].eventos).toEqual([
      expect.objectContaining({
        tipo: 'GOL',
        // O nome resolvido aqui evita que a tela precise cruzar participantes
        // com eventos por conta propria a cada render.
        nome: 'Ana',
        nomeRelacionado: 'Bia',
      }),
    ]);
  });

  it('oferece o elenco dos dois times para receber a correcao', async () => {
    const { servico } = montar();

    const { partidas } = await servico.listar('usuario-1', 'pelada-1');

    expect(partidas[0].timeCasa?.jogadores.map((j) => j.nome)).toEqual([
      'Ana',
      'Bia',
    ]);
    expect(partidas[0].timeVisitante?.jogadores.map((j) => j.nome)).toEqual([
      'Caio',
    ]);
  });

  it('usa o apelido quando existe, como o resto do app', async () => {
    const { servico } = montar({
      eventos: [
        {
          id: 'ev-2',
          partidaId: 'partida-1',
          tipo: TipoEventoPartida.BOLA_CHEIA,
          timeId: 'time-a',
          participanteId: 'p-bia',
          participanteRelacionadoId: null,
        },
      ] as unknown as EventoPartidaEntity[],
    });

    const { partidas } = await servico.listar('usuario-1', 'pelada-1');

    expect(partidas[0].eventos[0].nome).toBe('Bia');
    expect(partidas[0].eventos[0].nomeRelacionado).toBeNull();
  });

  it('responde 404 para pelada de outro organizador', async () => {
    const { servico } = montar();
    // A posse entra no WHERE, entao "de outro dono" chega aqui como inexistente.
    (servico as never as { peladas: { findOne: jest.Mock } }).peladas.findOne =
      jest.fn().mockResolvedValue(null);

    await expect(servico.listar('usuario-2', 'pelada-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
