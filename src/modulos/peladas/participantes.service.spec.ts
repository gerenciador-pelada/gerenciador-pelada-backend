import { DataSource, EntityManager } from 'typeorm';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { ParticipantesService } from './participantes.service';

const DONO = 'usuario-1';
const PELADA = 'pelada-1';

function criarServico(chegaram: Partial<ParticipantePeladaEntity>[]) {
  const atualizacoes: { id: string; ordem: number }[] = [];

  const gerenciador = {
    update: jest
      .fn()
      .mockImplementation((_e, id: string, dados: { ordemChegada: number }) => {
        atualizacoes.push({ id, ordem: dados.ordemChegada });
        return Promise.resolve({});
      }),
    find: jest.fn().mockResolvedValue(chegaram),
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
    { find: jest.fn().mockResolvedValue(chegaram) } as never,
    {
      transaction: (cb: (m: EntityManager) => Promise<unknown>) =>
        cb(gerenciador as unknown as EntityManager),
    } as unknown as DataSource,
  );

  return { servico, atualizacoes };
}

describe('ParticipantesService.reordenar', () => {
  const chegaram = [
    { id: 'a', ordemChegada: 1 },
    { id: 'b', ordemChegada: 2 },
    { id: 'c', ordemChegada: 3 },
  ];

  it('escreve em duas fases para nao colidir com o indice unico', async () => {
    // O indice (peladaId, ordemChegada) e UNIQUE. Escrever as posicoes finais
    // direto faria a troca de 1 com 2 bater no registro que ainda ocupa o 2.
    const { servico, atualizacoes } = criarServico(chegaram);

    await servico.reordenar(DONO, PELADA, ['b', 'a', 'c']);

    const negativas = atualizacoes.slice(0, 3);
    const finais = atualizacoes.slice(3);

    expect(negativas.every((u) => u.ordem < 0)).toBe(true);
    expect(finais).toEqual([
      { id: 'b', ordem: 1 },
      { id: 'a', ordem: 2 },
      { id: 'c', ordem: 3 },
    ]);
  });

  it('aceita reordenar com a pelada ja em andamento', async () => {
    // Quem chegou continua na ordem mesmo com status JOGANDO ou AGUARDANDO.
    const { servico } = criarServico(chegaram);

    await expect(
      servico.reordenar(DONO, PELADA, ['c', 'b', 'a']),
    ).resolves.toBeDefined();
  });

  it('recusa ordem que nao cobre todos os que chegaram', async () => {
    const { servico, atualizacoes } = criarServico(chegaram);

    await expect(
      servico.reordenar(DONO, PELADA, ['a', 'b']),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
    expect(atualizacoes).toHaveLength(0);
  });

  it('recusa ordem com id repetido', async () => {
    const { servico, atualizacoes } = criarServico(chegaram);

    await expect(
      servico.reordenar(DONO, PELADA, ['a', 'a', 'b']),
    ).rejects.toBeInstanceOf(ErroRegraPelada);
    expect(atualizacoes).toHaveLength(0);
  });
});
