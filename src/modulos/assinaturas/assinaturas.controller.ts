import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { Publico } from '../../comum/decoradores/publico.decorator';
import {
  UsuarioAtual,
  type UsuarioRequisicao,
} from '../../comum/decoradores/usuario-atual.decorator';
import { AssinaturasService } from './assinaturas.service';
import { ClienteAsaas } from './cliente-asaas';
import { AssinarDto } from './dto/assinar.dto';

@ApiTags('Assinaturas')
@ApiBearerAuth()
@Controller('assinaturas')
export class AssinaturasController {
  constructor(
    private readonly assinaturas: AssinaturasService,
    private readonly asaas: ClienteAsaas,
  ) {}

  @Get('minha')
  @ApiOperation({ summary: 'Assinatura do organizador logado' })
  async minha(@UsuarioAtual() u: UsuarioRequisicao) {
    const assinatura = await this.assinaturas.buscarMinha(u.id);
    return {
      // Sem assinatura nao e erro: e o estado de quem ainda nao assinou, e a
      // tela precisa saber a diferenca entre "nao tem" e "falhou".
      assinatura: assinatura && {
        status: assinatura.status,
        valorCentavos: assinatura.valorCentavos,
        ciclo: assinatura.ciclo,
        acessoAte: assinatura.acessoAte?.toISOString() ?? null,
      },
      cobrancaConfigurada: this.asaas.habilitado,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Cria a assinatura do gerenciador' })
  assinar(@UsuarioAtual() u: UsuarioRequisicao, @Body() dto: AssinarDto) {
    return this.assinaturas.assinar(u.id, {
      cpfCnpj: dto.cpfCnpj,
      valorCentavos: dto.valorCentavos,
      ciclo: dto.ciclo,
    });
  }

  @Delete()
  @ApiOperation({ summary: 'Cancela a assinatura mantendo o ciclo ja pago' })
  cancelar(@UsuarioAtual() u: UsuarioRequisicao) {
    return this.assinaturas.cancelar(u.id);
  }

  /**
   * Webhook do Asaas.
   *
   * Publico por natureza — quem chama e o Asaas, sem token de usuario. O que
   * autentica e o segredo combinado, que o Asaas devolve em `asaas-access-token`
   * a cada envio. Sem essa checagem, qualquer POST na internet diria "pagamento
   * confirmado" e ganharia acesso.
   *
   * Responde 200 mesmo para evento que nao interessa: erro faz o Asaas repetir
   * indefinidamente, e uma fila de repeticao atrasa os eventos que importam.
   */
  @Publico()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recebe eventos de cobranca do Asaas' })
  async webhook(
    @Headers('asaas-access-token') token: string | undefined,
    @Body() evento: { event: string; payment?: Record<string, unknown> },
  ) {
    this.exigirToken(token);
    return this.assinaturas.aplicarEvento(
      evento as Parameters<AssinaturasService['aplicarEvento']>[0],
    );
  }

  /**
   * Comparacao em tempo constante, como no convite de cadastro: comparar com
   * `===` vaza o tamanho do prefixo correto pelo tempo de resposta.
   */
  private exigirToken(recebido: string | undefined): void {
    const esperado = this.asaas.tokenWebhook;
    if (!esperado) throw new UnauthorizedException('Webhook nao configurado');

    const a = Buffer.from(recebido ?? '');
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      throw new UnauthorizedException('Token de webhook invalido');
  }
}
