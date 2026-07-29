import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Publico()
  @Post('cadastrar')
  @ApiOperation({ summary: 'Cria uma conta de organizador' })
  cadastrar(@Body() dto: CadastrarDto) {
    return this.autenticacao.cadastrar(dto);
  }

  @Publico()
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
}
