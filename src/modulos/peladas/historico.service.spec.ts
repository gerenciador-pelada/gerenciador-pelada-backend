import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { AcessoPeladaService } from './acesso-pelada.service';
import { ACAO_REGISTRO_EVENTO, HistoricoService } from './historico.service';

const DONO = 'usuario-1';
const INTRUSO = 'usuario-2';
const PELADA = 'pelada-1';

function criarAcesso(ehDoUsuario: boolean): AcessoPeladaService {
  return {
    garantirPelada: jest
      .fn()
      .mockImplementation(() =>
        ehDoUsuario
          ? Promise.resolve()
          : Promise.reject(new NotFoundException('Pelada nao encontrada')),
      ),
  } as unknown as AcessoPeladaService;
}

function criarServico(opcoes: {
  acao?: { acao: string; dadosPosteriores: Record<string, unknown> } | null;
  ehDoUsuario?: boolean;
  golsCasa?: number;
}) {
  const partida = {
    id: 'partida-1',
    timeCasaId: 'time-a',
    timeVisitanteId: 'time-b',
    golsCasa: opcoes.golsCasa ?? 2,
    golsVisitante: 1,
  };
  const removidos: unknown[] = [];
  const salvos: unknown[] = [];

  const gerenciador = {
    findOne: jest.fn().mockImplementation((entidade: unknown) => {
      if (entidade === EventoPartidaEntity)
        return Promise.resolve({ id: 'evento-1' });
      if (entidade === PartidaEntity) return Promise.resolve(partida);
      return Promise.resolve(null);
    }),
    softRemove: jest.fn().mockImplementation((e: unknown) => {
      removidos.push(e);
      return Promise.resolve(e);
    }),
    save: jest.fn().mockImplementation((e: unknown) => {
      salvos.push(e);
      return Promise.resolve(e);
    }),
  };

  const historico = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        opcoes.acao === null ? null : { desfeitaEm: null, ...opcoes.acao },
      ),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((d: unknown) => d),
    save: jest.fn().mockImplementation((d: unknown) => Promise.resolve(d)),
  };

  const servico = new HistoricoService(
    historico as never,
    criarAcesso(opcoes.ehDoUsuario ?? true),
    {
      transaction: (cb: (m: EntityManager) => Promise<unknown>) =>
        cb(gerenciador as unknown as EntityManager),
    } as unknown as DataSource,
  );

  return { servico, partida, removidos, salvos, historico };
}

describe('HistoricoService', () => {
  const acaoGol = {
    acao: ACAO_REGISTRO_EVENTO,
    dadosPosteriores: {
      eventoId: 'evento-1',
      partidaId: 'partida-1',
      tipo: TipoEventoPartida.GOL,
      timeId: 'time-a',
      descricao: 'gol',
    },
  };

  it('desfaz um gol removendo o evento e baixando o placar', async () => {
    const { servico, partida, removidos } = criarServico({ acao: acaoGol });

    await servico.desfazer(DONO, PELADA);

    expect(removidos).toHaveLength(1);
    expect(partida.golsCasa).toBe(1);
    expect(partida.golsVisitante).toBe(1);
  });

  it('baixa o placar do lado certo', async () => {
    const { servico, partida } = criarServico({
      acao: {
        ...acaoGol,
        dadosPosteriores: { ...acaoGol.dadosPosteriores, timeId: 'time-b' },
      },
    });

    await servico.desfazer(DONO, PELADA);

    expect(partida.golsCasa).toBe(2);
    expect(partida.golsVisitante).toBe(0);
  });

  it('desfaz gol contra baixando o placar do time beneficiado', async () => {
    const { servico, partida, removidos } = criarServico({
      acao: {
        ...acaoGol,
        dadosPosteriores: {
          ...acaoGol.dadosPosteriores,
          tipo: TipoEventoPartida.GOL_CONTRA,
          descricao: 'gol contra',
        },
      },
    });

    await servico.desfazer(DONO, PELADA);

    expect(removidos).toHaveLength(1);
    expect(partida.golsCasa).toBe(1);
    expect(partida.golsVisitante).toBe(1);
  });

  it('nao deixa o placar negativo', async () => {
    const { servico, partida } = criarServico({
      acao: acaoGol,
      golsCasa: 0,
    });

    await servico.desfazer(DONO, PELADA);

    expect(partida.golsCasa).toBe(0);
  });

  it('nao mexe no placar quando o evento nao e gol', async () => {
    const { servico, partida, removidos } = criarServico({
      acao: {
        ...acaoGol,
        dadosPosteriores: {
          ...acaoGol.dadosPosteriores,
          tipo: TipoEventoPartida.BOLA_CHEIA,
        },
      },
    });

    await servico.desfazer(DONO, PELADA);

    expect(removidos).toHaveLength(1);
    expect(partida.golsCasa).toBe(2);
  });

  it('avisa quando nao ha nada para desfazer', async () => {
    const { servico } = criarServico({ acao: null });

    await expect(servico.desfazer(DONO, PELADA)).rejects.toBeInstanceOf(
      ErroRegraPelada,
    );
  });

  it('recusa acao que ainda nao sabe se reverter, em vez de fingir', async () => {
    const { servico, removidos } = criarServico({
      acao: { acao: 'FINALIZACAO_PARTIDA', dadosPosteriores: {} },
    });

    await expect(servico.desfazer(DONO, PELADA)).rejects.toBeInstanceOf(
      ErroRegraPelada,
    );
    expect(removidos).toHaveLength(0);
  });

  it('recusa desfazer em pelada de outro organizador', async () => {
    const { servico, historico } = criarServico({
      acao: acaoGol,
      ehDoUsuario: false,
    });

    await expect(servico.desfazer(INTRUSO, PELADA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(historico.findOne).not.toHaveBeenCalled();
  });
});
