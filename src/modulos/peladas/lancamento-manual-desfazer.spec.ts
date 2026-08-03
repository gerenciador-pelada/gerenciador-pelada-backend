import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { PontuacaoJogadorEntity } from '../../banco/entidades/pontuacao-jogador.entity';
import { TimeEntity } from '../../banco/entidades/time.entity';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { LancamentoManualService } from './lancamento-manual.service';

const PELADA = 'pelada-1';
const DONO = 'usuario-1';

function montar(partidas: Partial<PartidaEntity>[]) {
  const apagados: { entidade: string; criterio: unknown }[] = [];
  const atualizados: unknown[] = [];

  const gerenciador = {
    find: jest.fn().mockImplementation((entidade: unknown) => {
      if (entidade === PartidaEntity) return Promise.resolve(partidas);
      if (entidade === ParticipacaoPartidaEntity)
        return Promise.resolve([
          { participanteId: 'part-1' },
          { participanteId: 'part-2' },
        ]);
      return Promise.resolve([]);
    }),
    delete: jest
      .fn()
      .mockImplementation((entidade: { name: string }, criterio: unknown) => {
        apagados.push({ entidade: entidade.name, criterio });
        return Promise.resolve({});
      }),
    update: jest.fn().mockImplementation((_e, _id, dados: unknown) => {
      atualizados.push(dados);
      return Promise.resolve({});
    }),
  };

  const servico = new LancamentoManualService(
    {
      findOne: jest.fn().mockResolvedValue({ id: PELADA, organizadorId: DONO }),
    } as unknown as Repository<PeladaEntity>,
    { find: jest.fn() } as unknown as Repository<JogadorEntity>,
    {
      transaction: (cb: (m: EntityManager) => Promise<unknown>) =>
        cb(gerenciador as unknown as EntityManager),
    } as unknown as DataSource,
  );

  return { servico, apagados, atualizados };
}

describe('LancamentoManualService.desfazer', () => {
  it('apaga o lancamento e reabre a edicao para lancar de novo', async () => {
    const { servico, apagados, atualizados } = montar([
      {
        id: 'partida-1',
        timeCasaId: 'time-1',
        timeVisitanteId: 'time-1',
      } as PartidaEntity,
    ]);

    const resultado = await servico.desfazer(DONO, PELADA);

    expect(resultado).toEqual({ partidaId: 'partida-1', participantes: 2 });

    // A ordem importa: o evento aponta para o participante com RESTRICT, entao
    // apagar o participante antes derrubaria a transacao inteira.
    expect(apagados.map((a) => a.entidade)).toEqual([
      PontuacaoJogadorEntity.name,
      EventoPartidaEntity.name,
      ParticipacaoPartidaEntity.name,
      PartidaEntity.name,
      TimeEntity.name,
      ParticipantePeladaEntity.name,
    ]);
    expect(atualizados).toEqual([
      { status: StatusPelada.ABERTA_INSCRICOES },
    ]);
  });

  it('recusa apagar uma pelada que foi jogada de verdade', async () => {
    // Dois times diferentes: veio de sorteio, nao de lancamento manual.
    const { servico, apagados } = montar([
      {
        id: 'partida-1',
        timeCasaId: 'time-a',
        timeVisitanteId: 'time-b',
      } as PartidaEntity,
    ]);

    await expect(servico.desfazer(DONO, PELADA)).rejects.toThrow(
      ErroRegraPelada,
    );
    expect(apagados).toHaveLength(0);
  });

  it('recusa quando a edicao tem mais de uma partida', async () => {
    const { servico, apagados } = montar([
      {
        id: 'p1',
        timeCasaId: 'time-1',
        timeVisitanteId: 'time-1',
      } as PartidaEntity,
      {
        id: 'p2',
        timeCasaId: 'time-a',
        timeVisitanteId: 'time-b',
      } as PartidaEntity,
    ]);

    await expect(servico.desfazer(DONO, PELADA)).rejects.toThrow(
      /nao tem um lancamento manual/i,
    );
    expect(apagados).toHaveLength(0);
  });

  it('responde 404 para pelada de outro organizador', async () => {
    const { servico } = montar([]);
    (
      servico as never as { peladas: { findOne: jest.Mock } }
    ).peladas.findOne = jest.fn().mockResolvedValue(null);

    await expect(servico.desfazer('outro', PELADA)).rejects.toThrow(
      NotFoundException,
    );
  });
});
