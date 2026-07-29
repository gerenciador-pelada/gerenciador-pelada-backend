import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ResultadoPaginado } from '../dto/resultado-paginado';

@Injectable()
export class InterceptadorResposta implements NestInterceptor {
  intercept(
    _contexto: ExecutionContext,
    proximo: CallHandler,
  ): Observable<unknown> {
    return proximo.handle().pipe(
      map((dados: unknown) => {
        if (dados instanceof ResultadoPaginado) {
          return {
            sucesso: true,
            dados: dados.itens,
            paginacao: dados.paginacao,
          };
        }
        return { sucesso: true, dados: dados ?? null };
      }),
    );
  }
}
