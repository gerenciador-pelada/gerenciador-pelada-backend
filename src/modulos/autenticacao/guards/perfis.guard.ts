import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHAVE_PERFIS } from '../../../comum/decoradores/perfis.decorator';
import { UsuarioRequisicao } from '../../../comum/decoradores/usuario-atual.decorator';
import { PerfilUsuario } from '../../../comum/enums/perfil-usuario.enum';

@Injectable()
export class PerfisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const permitidos = this.reflector.getAllAndOverride<PerfilUsuario[]>(
      CHAVE_PERFIS,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (!permitidos || permitidos.length === 0) {
      return true;
    }

    const usuario = contexto
      .switchToHttp()
      .getRequest<{ user?: UsuarioRequisicao }>().user;
    if (!usuario || !permitidos.includes(usuario.perfil)) {
      throw new ForbiddenException('Perfil sem permissao para esta operacao');
    }
    return true;
  }
}
