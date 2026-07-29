import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { PerfilUsuario } from '../enums/perfil-usuario.enum';

export interface UsuarioRequisicao {
  id: string;
  email: string;
  perfil: PerfilUsuario;
}

export const UsuarioAtual = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): UsuarioRequisicao => {
    return contexto.switchToHttp().getRequest<{ user: UsuarioRequisicao }>()
      .user;
  },
);
