import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PerfilUsuario } from '../../../comum/enums/perfil-usuario.enum';
import { PerfisGuard } from './perfis.guard';

function criarContexto(perfil?: PerfilUsuario): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () =>
        perfil ? { user: { id: '1', email: 'a@b.com', perfil } } : {},
    }),
  } as unknown as ExecutionContext;
}

describe('PerfisGuard', () => {
  function criarGuard(permitidos: PerfilUsuario[] | undefined) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(permitidos),
    };
    return new PerfisGuard(reflector as unknown as Reflector);
  }

  it('libera rota sem restricao de perfil', () => {
    expect(
      criarGuard(undefined).canActivate(
        criarContexto(PerfilUsuario.ORGANIZADOR),
      ),
    ).toBe(true);
  });

  it('libera quando o perfil do usuario esta na lista', () => {
    const guard = criarGuard([PerfilUsuario.ADMINISTRADOR]);
    expect(guard.canActivate(criarContexto(PerfilUsuario.ADMINISTRADOR))).toBe(
      true,
    );
  });

  it('bloqueia organizador em rota exclusiva de administrador', () => {
    const guard = criarGuard([PerfilUsuario.ADMINISTRADOR]);
    expect(() =>
      guard.canActivate(criarContexto(PerfilUsuario.ORGANIZADOR)),
    ).toThrow(ForbiddenException);
  });

  it('bloqueia requisicao sem usuario autenticado', () => {
    const guard = criarGuard([PerfilUsuario.ADMINISTRADOR]);
    expect(() => guard.canActivate(criarContexto())).toThrow(
      ForbiddenException,
    );
  });
});
