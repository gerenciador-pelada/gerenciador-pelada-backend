import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Publico } from '../../comum/decoradores/publico.decorator';
import {
  UsuarioAtual,
  type UsuarioRequisicao,
} from '../../comum/decoradores/usuario-atual.decorator';
import { AutenticacaoService } from './autenticacao.service';
import { CadastrarDto } from './dto/cadastrar.dto';
import { EntrarDto } from './dto/entrar.dto';

@ApiTags('Autenticacao')
@Controller('autenticacao')
export class AutenticacaoController {
  constructor(private readonly autenticacao: AutenticacaoService) {}

  // As duas rotas abaixo sao as unicas que respondem sem token, entao sao as
  // unicas onde alguem pode martelar tentativas. Limite bem mais apertado que
  // o global: cinco por minuto atrapalha forca bruta e nao atrapalha ninguem
  // que so errou a senha.
  @Publico()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('cadastrar')
  @ApiOperation({ summary: 'Cria uma conta de organizador (exige convite)' })
  cadastrar(@Body() dto: CadastrarDto) {
    return this.autenticacao.cadastrar(dto);
  }

  @Publico()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('entrar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica e devolve o token JWT' })
  entrar(@Body() dto: EntrarDto) {
    return this.autenticacao.entrar(dto);
  }

  @Get('perfil')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Devolve o usuario autenticado' })
  perfil(@UsuarioAtual() usuario: UsuarioRequisicao) {
    return usuario;
  }

  /**
   * Exclui a conta de quem esta chamando. Sem parametro de id: o alvo e sempre
   * o dono do token, entao nao existe forma de apontar esta rota para outra
   * pessoa.
   */
  @Delete('conta')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Exclui a conta do usuario autenticado' })
  async excluirConta(@UsuarioAtual() usuario: UsuarioRequisicao) {
    await this.autenticacao.excluirPropriaConta(usuario.id);
  }
}
