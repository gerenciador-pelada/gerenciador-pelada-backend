import request from 'supertest';
import { AplicacaoTeste, criarAplicacaoTeste } from './aplicacao-teste';

describe('Jogadores (e2e)', () => {
  let ambiente: AplicacaoTeste;

  beforeAll(async () => {
    ambiente = await criarAplicacaoTeste();
  });

  beforeEach(async () => {
    await ambiente.limpar();
  });

  afterAll(async () => {
    await ambiente.encerrar();
  });

  async function autenticar(email: string): Promise<string> {
    const resposta = await request(ambiente.app.getHttpServer())
      .post('/api/autenticacao/cadastrar')
      .send({ nome: 'Organizador', email, senha: 'senhaSegura1' })
      .expect(201);
    return resposta.body.dados.token as string;
  }

  it('cadastra, lista, atualiza e remove um jogador', async () => {
    const token = await autenticar('a@pelada.com');
    const servidor = ambiente.app.getHttpServer();

    const criado = await request(servidor)
      .post('/api/jogadores')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Ronaldo', apelido: 'Fenomeno', podeSerGoleiro: false })
      .expect(201);

    const id = criado.body.dados.id as string;

    const lista = await request(servidor)
      .get('/api/jogadores?busca=ronal')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(lista.body.dados).toHaveLength(1);
    expect(lista.body.paginacao.total).toBe(1);

    await request(servidor)
      .patch(`/api/jogadores/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ podeSerGoleiro: true })
      .expect(200);

    await request(servidor)
      .delete(`/api/jogadores/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(servidor)
      .get(`/api/jogadores/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('isola os jogadores entre organizadores diferentes', async () => {
    const servidor = ambiente.app.getHttpServer();
    const tokenA = await autenticar('a@pelada.com');
    const tokenB = await autenticar('b@pelada.com');

    const criado = await request(servidor)
      .post('/api/jogadores')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nome: 'Ronaldo' })
      .expect(201);

    await request(servidor)
      .get(`/api/jogadores/${criado.body.dados.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    const listaB = await request(servidor)
      .get('/api/jogadores')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(listaB.body.dados).toHaveLength(0);
  });

  it('recusa nome duplicado para o mesmo organizador com 409', async () => {
    const servidor = ambiente.app.getHttpServer();
    const token = await autenticar('a@pelada.com');

    await request(servidor)
      .post('/api/jogadores')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Ronaldo' })
      .expect(201);

    await request(servidor)
      .post('/api/jogadores')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Ronaldo' })
      .expect(409);
  });
});
