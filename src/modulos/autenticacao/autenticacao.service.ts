import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { UsuarioEntity } from '../../banco/entidades/usuario.entity';
import { PerfilUsuario } from '../../comum/enums/perfil-usuario.enum';
import { lerConviteCadastro } from '../../configuracao/configuracao';
import { CadastrarDto } from './dto/cadastrar.dto';
import { EntrarDto } from './dto/entrar.dto';

export interface UsuarioPublico {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
}

export interface RespostaAutenticacao {
  usuario: UsuarioPublico;
  token: string;
}

const RODADAS_HASH = 10;

@Injectable()
export class AutenticacaoService {
  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuarios: Repository<UsuarioEntity>,
    private readonly jwt: JwtService,
  ) {}

  async cadastrar(dto: CadastrarDto): Promise<RespostaAutenticacao> {
    this.exigirConvite(dto.convite);

    const email = dto.email.trim().toLowerCase();

    const existente = await this.usuarios.findOne({ where: { email } });
    if (existente) {
      throw new ConflictException('Ja existe um usuario com este e-mail');
    }

    const usuario = this.usuarios.create({
      nome: dto.nome.trim(),
      email,
      senhaHash: await bcrypt.hash(dto.senha, RODADAS_HASH),
      perfil: PerfilUsuario.ORGANIZADOR,
      ativo: true,
    });

    const salvo = await this.usuarios.save(usuario);
    return this.montarResposta(salvo);
  }

  async entrar(dto: EntrarDto): Promise<RespostaAutenticacao> {
    const email = dto.email.trim().toLowerCase();

    const usuario = await this.usuarios
      .createQueryBuilder('usuario')
      .addSelect('usuario.senhaHash')
      .where('usuario.email = :email', { email })
      .getOne();

    const senhaConfere =
      usuario !== null && (await bcrypt.compare(dto.senha, usuario.senhaHash));

    if (!usuario || !senhaConfere || !usuario.ativo) {
      throw new UnauthorizedException('E-mail ou senha invalidos');
    }

    return this.montarResposta(usuario);
  }

  /**
   * O cadastro cria um ORGANIZADOR, entao ele nao pode ficar aberto num
   * endereco que estranhos alcancam. Sem CADASTRO_CONVITE configurado o
   * cadastro fica fechado: negar por padrao, e nao liberar por esquecimento.
   */
  private exigirConvite(informado: string | undefined): void {
    const esperado = lerConviteCadastro();

    if (esperado === null) {
      throw new ForbiddenException(
        'Cadastro fechado. Peca ao organizador um codigo de convite.',
      );
    }

    const recebido = Buffer.from(informado?.trim() ?? '', 'utf8');
    const alvo = Buffer.from(esperado, 'utf8');

    // Comparacao de tempo constante: `===` vaza o tamanho do prefixo correto
    // pelo tempo de resposta, e o convite e adivinhavel caractere a caractere.
    const confere =
      recebido.length === alvo.length && timingSafeEqual(recebido, alvo);

    if (!confere) {
      throw new ForbiddenException('Codigo de convite invalido.');
    }
  }

  protected async montarResposta(
    usuario: UsuarioEntity,
  ): Promise<RespostaAutenticacao> {
    const publico: UsuarioPublico = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    };
    const token = await this.jwt.signAsync({
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
    });
    return { usuario: publico, token };
  }
}
