import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UsuarioEntity } from '../../banco/entidades/usuario.entity';
import { UsuarioRequisicao } from '../../comum/decoradores/usuario-atual.decorator';
import { lerConfiguracaoJwt } from '../../configuracao/configuracao';

interface ConteudoToken {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuarios: Repository<UsuarioEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: lerConfiguracaoJwt().segredo,
    });
  }

  async validate(conteudo: ConteudoToken): Promise<UsuarioRequisicao> {
    const usuario = await this.usuarios.findOne({
      where: { id: conteudo.sub },
    });
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Sessao invalida');
    }
    return { id: usuario.id, email: usuario.email, perfil: usuario.perfil };
  }
}
