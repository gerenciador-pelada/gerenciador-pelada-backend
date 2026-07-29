import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { FiltroExcecoesGlobal } from './filtro-excecoes-global';

function criarHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/teste', method: 'POST' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('FiltroExcecoesGlobal', () => {
  it('traduz ErroRegraPelada para 422 preservando o codigo', () => {
    const { host, status, json } = criarHost();

    new FiltroExcecoesGlobal().catch(
      new ErroRegraPelada('JOGADORES_INSUFICIENTES', 'Faltam 3 jogadores'),
      host,
    );

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        sucesso: false,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        erro: expect.objectContaining({
          codigo: 'JOGADORES_INSUFICIENTES',
          mensagem: 'Faltam 3 jogadores',
        }),
      }),
    );
  });

  it('traduz HttpException do Nest preservando o status', () => {
    const { host, status, json } = criarHost();

    new FiltroExcecoesGlobal().catch(
      new BadRequestException('email invalido'),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        sucesso: false,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        erro: expect.objectContaining({ codigo: 'REQUISICAO_INVALIDA' }),
      }),
    );
  });

  it('trata erro desconhecido como 500 sem vazar a mensagem interna', () => {
    const { host, status, json } = criarHost();

    new FiltroExcecoesGlobal().catch(new Error('senha do banco no log'), host);

    expect(status).toHaveBeenCalledWith(500);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain(
      'senha do banco',
    );
  });
});
