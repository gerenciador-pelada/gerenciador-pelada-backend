import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfiguracaoPeladaEntity } from '../../banco/entidades/configuracao-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { ModalidadeGoleiro } from '../../comum/enums/modalidade-goleiro.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { ConfiguracoesService } from './configuracoes.service';

const DONO = 'usuario-1';

describe('ConfiguracoesService', () => {
  let servico: ConfiguracoesService;
  const peladas = { findOne: jest.fn() };
  const configuracoes = { save: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        ConfiguracoesService,
        { provide: getRepositoryToken(PeladaEntity), useValue: peladas },
        {
          provide: getRepositoryToken(ConfiguracaoPeladaEntity),
          useValue: configuracoes,
        },
      ],
    }).compile();
    servico = modulo.get(ConfiguracoesService);
    configuracoes.save.mockImplementation((d: ConfiguracaoPeladaEntity) =>
      Promise.resolve(d),
    );
  });

  function prepararPelada(status: StatusPelada): void {
    peladas.findOne.mockResolvedValue({
      id: 'pelada-1',
      status,
      configuracao: {
        id: 'config-1',
        jogadoresLinhaPorTime: 5,
        quantidadeGoleiros: 2,
        modalidadeGoleiro: ModalidadeGoleiro.FIXO,
        pontosVitoria: 3,
        duracaoPartidaMinutos: 10,
      } as ConfiguracaoPeladaEntity,
    });
  }

  it('nao encontra pelada de outro organizador', async () => {
    peladas.findOne.mockResolvedValue(null);

    await expect(
      servico.buscar('usuario-2', 'pelada-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('com a pelada aberta para inscricoes', () => {
    it('permite alterar campo estrutural', async () => {
      prepararPelada(StatusPelada.ABERTA_INSCRICOES);

      const atualizada = await servico.atualizar(DONO, 'pelada-1', {
        jogadoresLinhaPorTime: 6,
      });

      expect(atualizada.jogadoresLinhaPorTime).toBe(6);
    });

    it('permite alterar pontuacao', async () => {
      prepararPelada(StatusPelada.ABERTA_INSCRICOES);

      const atualizada = await servico.atualizar(DONO, 'pelada-1', {
        pontosVitoria: 2,
      });

      expect(atualizada.pontosVitoria).toBe(2);
    });
  });

  describe('com a pelada em andamento', () => {
    it('recusa alterar jogadoresLinhaPorTime', async () => {
      prepararPelada(StatusPelada.EM_ANDAMENTO);

      await expect(
        servico.atualizar(DONO, 'pelada-1', { jogadoresLinhaPorTime: 6 }),
      ).rejects.toBeInstanceOf(ErroRegraPelada);
      expect(configuracoes.save).not.toHaveBeenCalled();
    });

    it('recusa alterar modalidadeGoleiro', async () => {
      prepararPelada(StatusPelada.EM_ANDAMENTO);

      await expect(
        servico.atualizar(DONO, 'pelada-1', {
          modalidadeGoleiro: ModalidadeGoleiro.ROTATIVO,
        }),
      ).rejects.toBeInstanceOf(ErroRegraPelada);
    });

    it('lista os campos travados nos detalhes do erro', async () => {
      prepararPelada(StatusPelada.EM_ANDAMENTO);

      const erro = await servico
        .atualizar(DONO, 'pelada-1', {
          jogadoresLinhaPorTime: 6,
          quantidadeGoleiros: 1,
        })
        .catch((e: unknown) => e as ErroRegraPelada);

      expect(erro).toBeInstanceOf(ErroRegraPelada);
      expect(erro.codigo).toBe('CONFIGURACAO_ESTRUTURAL_TRAVADA');
      expect(erro.detalhes).toEqual({
        campos: ['jogadoresLinhaPorTime', 'quantidadeGoleiros'],
      });
    });

    it('permite alterar pontuacao e duracao', async () => {
      prepararPelada(StatusPelada.EM_ANDAMENTO);

      const atualizada = await servico.atualizar(DONO, 'pelada-1', {
        pontosVitoria: 2,
        duracaoPartidaMinutos: 12,
      });

      expect(atualizada.pontosVitoria).toBe(2);
      expect(atualizada.duracaoPartidaMinutos).toBe(12);
    });

    it('aceita informar um campo estrutural com o mesmo valor que ja tinha', async () => {
      prepararPelada(StatusPelada.EM_ANDAMENTO);

      const atualizada = await servico.atualizar(DONO, 'pelada-1', {
        jogadoresLinhaPorTime: 5,
        pontosVitoria: 2,
      });

      expect(atualizada.pontosVitoria).toBe(2);
    });
  });

  describe('com a pelada encerrada', () => {
    it('recusa qualquer alteracao numa pelada finalizada', async () => {
      prepararPelada(StatusPelada.FINALIZADA);

      await expect(
        servico.atualizar(DONO, 'pelada-1', { pontosVitoria: 2 }),
      ).rejects.toBeInstanceOf(ErroRegraPelada);
    });

    it('recusa qualquer alteracao numa pelada cancelada', async () => {
      prepararPelada(StatusPelada.CANCELADA);

      await expect(
        servico.atualizar(DONO, 'pelada-1', { pontosVitoria: 2 }),
      ).rejects.toBeInstanceOf(ErroRegraPelada);
    });
  });
});
