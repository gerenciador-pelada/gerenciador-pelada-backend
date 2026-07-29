import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';

interface RespostaErro {
  sucesso: false;
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: unknown;
  };
  caminho: string;
  data: string;
}

@Catch()
export class FiltroExcecoesGlobal implements ExceptionFilter {
  private readonly logger = new Logger(FiltroExcecoesGlobal.name);

  catch(excecao: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const resposta = contexto.getResponse<{
      status: (codigo: number) => { json: (corpo: RespostaErro) => void };
    }>();
    const requisicao = contexto.getRequest<{ url: string; method: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let codigo = 'ERRO_INTERNO';
    let mensagem = 'Erro interno do servidor';
    let detalhes: unknown;

    if (excecao instanceof ErroRegraPelada) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      codigo = excecao.codigo;
      mensagem = excecao.message;
      detalhes = excecao.detalhes;
    } else if (excecao instanceof HttpException) {
      status = excecao.getStatus();
      const corpo = excecao.getResponse();
      codigo = this.codigoPorStatus(status);
      if (typeof corpo === 'string') {
        mensagem = corpo;
      } else {
        const objeto = corpo as { message?: string | string[] };
        mensagem = Array.isArray(objeto.message)
          ? 'Dados invalidos na requisicao'
          : (objeto.message ?? excecao.message);
        detalhes = Array.isArray(objeto.message) ? objeto.message : undefined;
      }
    } else {
      this.logger.error(
        `Erro nao tratado em ${requisicao.method} ${requisicao.url}`,
        excecao instanceof Error ? excecao.stack : String(excecao),
      );
    }

    resposta.status(status).json({
      sucesso: false,
      erro: { codigo, mensagem, detalhes },
      caminho: requisicao.url,
      data: new Date().toISOString(),
    });
  }

  private codigoPorStatus(status: number): string {
    const mapa: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'REQUISICAO_INVALIDA',
      [HttpStatus.UNAUTHORIZED]: 'NAO_AUTENTICADO',
      [HttpStatus.FORBIDDEN]: 'ACESSO_NEGADO',
      [HttpStatus.NOT_FOUND]: 'NAO_ENCONTRADO',
      [HttpStatus.CONFLICT]: 'CONFLITO',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'REGRA_VIOLADA',
    };
    return mapa[status] ?? 'ERRO_HTTP';
  }
}
