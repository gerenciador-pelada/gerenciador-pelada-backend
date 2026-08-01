import { PerfilUsuario } from '../../comum/enums/perfil-usuario.enum';
import { PeladasController } from './peladas.controller';

// O controller recebe o usuario ja resolvido pelo guard, com perfil e
// e-mail. Montar so o id fazia o teste divergir do que a producao entrega.
const USUARIO = {
  id: 'usuario-1',
  email: 'organizador@pelada.com',
  perfil: PerfilUsuario.ORGANIZADOR,
};
const ID = '11111111-1111-4111-8111-111111111111';

describe('PeladasController', () => {
  const peladas = {
    criar: jest.fn(),
    listar: jest.fn(),
    buscarPorId: jest.fn(),
    atualizar: jest.fn(),
    alterarStatus: jest.fn(),
    remover: jest.fn(),
  };
  const configuracoes = { buscar: jest.fn(), atualizar: jest.fn() };
  const participantes = {};
  const sorteios = {};
  const partidas = { finalizarPelada: jest.fn() };
  const eventos = {};
  const rankings = {};
  const historico = {};
  const painel = {};
  const fila = {};
  const rankingPublico = {};
  const financeiro = {};
  const estatisticas = {};
  const lancamento = {};
  const controller = new PeladasController(
    peladas as never,
    configuracoes as never,
    participantes as never,
    sorteios as never,
    partidas as never,
    eventos as never,
    rankings as never,
    historico as never,
    painel as never,
    fila as never,
    rankingPublico as never,
    financeiro as never,
    estatisticas as never,
    lancamento as never,
  );

  beforeEach(() => jest.resetAllMocks());

  it('cria pelada para o usuario autenticado', () => {
    const dto = {
      grupoId: ID,
      dataHora: '2026-08-01T19:00:00-03:00',
      localId: ID,
    };

    void controller.criar(USUARIO, dto);

    expect(peladas.criar).toHaveBeenCalledWith(USUARIO.id, dto);
  });

  it('lista as peladas do usuario autenticado', () => {
    const filtro = { pagina: 1, limite: 20, pular: 0 };

    void controller.listar(USUARIO, filtro);

    expect(peladas.listar).toHaveBeenCalledWith(USUARIO.id, filtro);
  });

  it('busca e atualiza uma pelada pelo id', () => {
    const dto = { dataHora: '2026-08-08T19:00:00-03:00' };

    void controller.buscar(USUARIO, ID);
    void controller.atualizar(USUARIO, ID, dto);

    expect(peladas.buscarPorId).toHaveBeenCalledWith(USUARIO.id, ID);
    expect(peladas.atualizar).toHaveBeenCalledWith(USUARIO.id, ID, dto);
  });

  it('altera o status e remove uma pelada', () => {
    void controller.alterarStatus(USUARIO, ID, {
      status: 'EM_ANDAMENTO',
    } as never);
    void controller.remover(USUARIO, ID);

    expect(peladas.alterarStatus).toHaveBeenCalledWith(
      USUARIO.id,
      ID,
      'EM_ANDAMENTO',
    );
    expect(peladas.remover).toHaveBeenCalledWith(USUARIO.id, ID);
  });

  it('busca e atualiza a configuracao da pelada', () => {
    const dto = { pontosVitoria: 2 };

    void controller.buscarConfiguracao(USUARIO, ID);
    void controller.atualizarConfiguracao(USUARIO, ID, dto);

    expect(configuracoes.buscar).toHaveBeenCalledWith(USUARIO.id, ID);
    expect(configuracoes.atualizar).toHaveBeenCalledWith(USUARIO.id, ID, dto);
  });

  it('finaliza a pelada autenticada com eventual vencedor da decisao', () => {
    const dto = { vencedorDecisao: 'CASA' as const };

    void controller.finalizarPelada(USUARIO, ID, dto);

    expect(partidas.finalizarPelada).toHaveBeenCalledWith(USUARIO.id, ID, dto);
  });
});
