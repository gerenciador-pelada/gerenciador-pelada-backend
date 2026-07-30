import request from 'supertest';
import { AplicacaoTeste, criarAplicacaoTeste } from './aplicacao-teste';

describe('Autenticacao (e2e)', () => {
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

  const credencial = {
    nome: 'Lucas Alexandre',
    email: 'lucas@pelada.com',
    senha: 'senhaSegura1',
    convite: 'convite-de-teste',
  };

  it('cadastra, autentica e consulta o perfil', async () => {
    const cadastro = await request(ambiente.app.getHttpServer())
      .post('/api/autenticacao/cadastrar')
      .send(credencial)
      .expect(201);

    expect(cadastro.body.sucesso).toBe(true);
    expect(cadastro.body.dados.token).toBeDefined();
    expect(cadastro.body.dados.usuario).not.toHaveProperty('senhaHash');

    const login = await request(ambiente.app.getHttpServer())
      .post('/api/autenticacao/entrar')
      .send({ email: credencial.email, senha: credencial.senha })
      .expect(200);

    const perfil = await request(ambiente.app.getHttpServer())
      .get('/api/autenticacao/perfil')
      .set('Authorization', `Bearer ${login.body.dados.token}`)
      .expect(200);

    expect(perfil.body.dados.email).toBe(credencial.email);
    expect(perfil.body.dados.perfil).toBe('ORGANIZADOR');
  });

  it('recusa cadastro duplicado com 409', async () => {
    await request(ambiente.app.getHttpServer())
      .post('/api/autenticacao/cadastrar')
      .send(credencial)
      .expect(201);

    const repetido = await request(ambiente.app.getHttpServer())
      .post('/api/autenticacao/cadastrar')
      .send(credencial)
      .expect(409);

    expect(repetido.body.erro.codigo).toBe('CONFLITO');
  });

  it('recusa campo desconhecido no corpo com 400', async () => {
    const resposta = await request(ambiente.app.getHttpServer())
      .post('/api/autenticacao/cadastrar')
      .send({ ...credencial, perfil: 'ADMINISTRADOR' })
      .expect(400);

    expect(resposta.body.erro.codigo).toBe('REQUISICAO_INVALIDA');
  });

  it('bloqueia rota protegida sem token com 401', async () => {
    const resposta = await request(ambiente.app.getHttpServer())
      .get('/api/autenticacao/perfil')
      .expect(401);

    expect(resposta.body.erro.codigo).toBe('NAO_AUTENTICADO');
  });
});
