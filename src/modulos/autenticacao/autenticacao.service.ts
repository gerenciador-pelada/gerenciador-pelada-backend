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

  /**
   * A pessoa exclui a propria conta.
   *
   * Existe porque a App Store recusa app que cria conta e nao deixa apaga-la
   * pelo proprio app (diretriz 5.1.1(v)) — e desativar nao conta, precisa ser
   * exclusao.
   *
   * Mora aqui e nao em `UsuariosService` porque aquele controller inteiro e
   * `@Perfis(ADMINISTRADOR)`: a rota precisa ser alcancavel por quem esta so
   * autenticado, que e todo mundo.
   *
   * O que acontece na hora:
   *
   * - a identidade e apagada de verdade. Nome, e-mail e senha saem do banco
   *   agora, e nao daqui a trinta dias: sao o dado mais identificavel que
   *   existe aqui, e nao ha razao para segura-los;
   * - a conta some. `softRemove` mais `ativo: false` fecham as duas portas —
   *   `findOne` ignora registro removido logicamente tanto no login quanto na
   *   validacao do token, entao sessao aberta em outro aparelho tambem cai;
   * - as peladas ficam ate o expurgo. Elas guardam nomes de terceiros e
   *   historico de partidas, e apaga-las em cascata aqui esbarraria nos
   *   `RESTRICT` que protegem o autor de cada gol.
   *
   * O e-mail vira endereco invalido e unico em vez de sumir para nulo porque o
   * indice de e-mail e unico e NAO e parcial: mantendo o endereco real, a
   * pessoa nunca mais conseguiria se cadastrar de novo com ele.
   */
  async excluirPropriaConta(usuarioId: string): Promise<void> {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new UnauthorizedException('Sessao invalida');

    usuario.nome = 'Conta excluida';
    usuario.email = `excluido-${usuario.id}@invalido.local`;
    // Nao fica vazio: a coluna nao aceita nulo, e um hash invalido garante que
    // nenhuma senha do mundo confira caso a linha reapareca por engano.
    usuario.senhaHash = 'conta-excluida';
    usuario.ativo = false;

    await this.usuarios.save(usuario);
    await this.usuarios.softRemove(usuario);
  }
}
