import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssinaturaEntity } from '../../banco/entidades/assinatura.entity';
import { UsuarioEntity } from '../../banco/entidades/usuario.entity';
import { StatusAssinatura } from '../../comum/enums/status-assinatura.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { ClienteAsaas } from './cliente-asaas';
import { PLANOS, type CodigoPlano } from './planos';

/** Reais com centavos, como o Asaas espera. Nunca `centavos / 100` solto. */
const paraReais = (centavos: number): number =>
  Number((centavos / 100).toFixed(2));

/** `2026-08-05`, o formato de data do Asaas. */
function paraDataAsaas(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export interface DadosAssinatura {
  cpfCnpj: string;
  /** So o plano: o preco vem da tabela do servidor, nunca do cliente. */
  plano: CodigoPlano;
}

/**
 * Assinatura do gerenciador, cobrada pelo Asaas.
 *
 * O espelho local responde "esta pago?" sem ir na rede; o Asaas continua sendo
 * a verdade, e o webhook e quem sincroniza os dois. Esta ordem importa: criar
 * primeiro no Asaas e so entao gravar aqui. O contrario deixaria uma assinatura
 * no banco que ninguem cobra — e o organizador usando de graca sem saber.
 */
@Injectable()
export class AssinaturasService {
  private readonly log = new Logger(AssinaturasService.name);

  constructor(
    @InjectRepository(AssinaturaEntity)
    private readonly assinaturas: Repository<AssinaturaEntity>,
    @InjectRepository(UsuarioEntity)
    private readonly usuarios: Repository<UsuarioEntity>,
    private readonly asaas: ClienteAsaas,
  ) {}

  async buscarMinha(usuarioId: string): Promise<AssinaturaEntity | null> {
    return this.assinaturas.findOne({ where: { usuarioId } });
  }

  /**
   * Link da fatura em aberto, para a tela mandar o organizador pagar.
   *
   * Devolve a cobranca pendente mais recente. Sem isso a tela criava a
   * assinatura e nao tinha para onde apontar — o organizador ficava com uma
   * cobranca esperando e nenhuma forma de chegar nela.
   */
  async linkDePagamento(usuarioId: string): Promise<string | null> {
    const assinatura = await this.assinaturas.findOne({ where: { usuarioId } });
    if (!assinatura || !this.asaas.habilitado) return null;

    try {
      const cobrancas = await this.asaas.cobrancasDaAssinatura(
        assinatura.asaasAssinaturaId,
      );
      const aberta = cobrancas.find(
        (c) => c.status === 'PENDING' || c.status === 'OVERDUE',
      );
      return aberta?.invoiceUrl ?? null;
    } catch {
      // A tela funciona sem o link: mostra o estado e some com o botao de
      // pagar. Melhor do que a tela inteira falhar por causa do Asaas.
      this.log.warn('Nao consegui listar as cobrancas da assinatura');
      return null;
    }
  }

  async assinar(
    usuarioId: string,
    dados: DadosAssinatura,
  ): Promise<AssinaturaEntity> {
    if (!this.asaas.habilitado)
      throw new ErroRegraPelada(
        'ASAAS_NAO_CONFIGURADO',
        'A cobranca nao esta configurada neste servidor',
      );

    const existente = await this.assinaturas.findOne({ where: { usuarioId } });
    if (existente && existente.status !== StatusAssinatura.CANCELADA)
      throw new ErroRegraPelada(
        'ASSINATURA_JA_EXISTE',
        'Voce ja tem uma assinatura. Cancele antes de criar outra.',
      );

    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');

    const documento = dados.cpfCnpj.replace(/\D/g, '');
    if (documento.length !== 11 && documento.length !== 14)
      throw new ErroRegraPelada(
        'DOCUMENTO_INVALIDO',
        'Informe um CPF ou CNPJ valido',
      );

    const plano = PLANOS[dados.plano];

    // Um cliente por organizador no Asaas. Reaproveita quando ja existe, senao
    // cada nova tentativa criaria um cadastro solto la.
    const clienteId =
      existente?.asaasClienteId ??
      (
        await this.asaas.criarCliente({
          name: usuario.nome,
          email: usuario.email,
          cpfCnpj: documento,
        })
      ).id;

    // Primeiro vencimento hoje: o acesso so abre quando o pagamento confirma,
    // entao adiar a primeira cobranca seria dar o mes de graca.
    const criada = await this.asaas.criarAssinatura({
      customer: clienteId,
      value: paraReais(plano.valorCentavos),
      nextDueDate: paraDataAsaas(new Date()),
      cycle: plano.ciclo,
      description: 'Gerenciador de Peladas',
      // UNDEFINED deixa o pagador escolher entre Pix, boleto e cartao na
      // fatura. Fixar aqui excluiria quem nao usa aquele meio.
      billingType: 'UNDEFINED',
      // Volta no webhook: e como o evento acha o dono sem depender de o
      // espelho local ja existir.
      externalReference: usuarioId,
    });

    const assinatura = this.assinaturas.create({
      ...(existente ? { id: existente.id } : {}),
      usuarioId,
      asaasClienteId: clienteId,
      asaasAssinaturaId: criada.id,
      // Nasce VENCIDA, nao ATIVA: nada foi pago ainda. Nascer ativa daria um
      // ciclo gratis a cada nova assinatura.
      status: StatusAssinatura.VENCIDA,
      valorCentavos: plano.valorCentavos,
      ciclo: plano.ciclo,
      acessoAte: null,
    });

    return this.assinaturas.save(assinatura);
  }

  async cancelar(usuarioId: string): Promise<AssinaturaEntity> {
    const assinatura = await this.assinaturas.findOne({ where: { usuarioId } });
    if (!assinatura) throw new NotFoundException('Assinatura nao encontrada');
    if (assinatura.status === StatusAssinatura.CANCELADA) return assinatura;

    await this.asaas.cancelarAssinatura(assinatura.asaasAssinaturaId);

    // `acessoAte` fica como esta: o ciclo ja pago vale ate o fim. Cortar na
    // hora do cancelamento seria receber por um mes e entregar meio.
    assinatura.status = StatusAssinatura.CANCELADA;
    return this.assinaturas.save(assinatura);
  }

  /**
   * Aplica um evento de webhook do Asaas.
   *
   * Idempotente de proposito: o Asaas repete o mesmo evento ate receber 200, e
   * um evento repetido nao pode virar um mes a mais de acesso. Por isso a
   * decisao olha o estado alvo, e nao "soma um ciclo".
   */
  async aplicarEvento(evento: {
    event: string;
    payment?: {
      subscription?: string | null;
      dueDate?: string | null;
      value?: number;
    };
  }): Promise<{ aplicado: boolean }> {
    const idAssinatura = evento.payment?.subscription;
    if (!idAssinatura) return { aplicado: false };

    const assinatura = await this.assinaturas.findOne({
      where: { asaasAssinaturaId: idAssinatura },
    });
    if (!assinatura) {
      // Evento de uma assinatura que este servidor nao conhece — outro
      // ambiente usando a mesma conta Asaas, por exemplo. Ignorar e responder
      // 200: devolver erro faria o Asaas repetir para sempre.
      this.log.warn(`Webhook de assinatura desconhecida: ${idAssinatura}`);
      return { aplicado: false };
    }

    const confirmado =
      evento.event === 'PAYMENT_CONFIRMED' ||
      evento.event === 'PAYMENT_RECEIVED';
    const perdido =
      evento.event === 'PAYMENT_OVERDUE' ||
      evento.event === 'PAYMENT_DELETED' ||
      evento.event === 'PAYMENT_REFUNDED' ||
      evento.event === 'PAYMENT_CHARGEBACK_REQUESTED';

    if (!confirmado && !perdido) return { aplicado: false };

    if (confirmado) {
      assinatura.status = StatusAssinatura.ATIVA;
      assinatura.acessoAte = await this.ateQuandoVale(assinatura);
    } else {
      assinatura.status = StatusAssinatura.VENCIDA;
    }

    await this.assinaturas.save(assinatura);
    return { aplicado: true };
  }

  /**
   * Ate quando o ciclo recem-pago vale.
   *
   * Vem do `nextDueDate` da assinatura no Asaas, e nao do vencimento da
   * cobranca que acabou de ser paga. Sao datas diferentes: a cobranca vencia
   * hoje, e o ciclo que ela paga vai ate a proxima. Usar a do evento dava
   * acesso ate o fim do mesmo dia — quem pagasse ficaria sem o app no dia
   * seguinte. So apareceu rodando contra o sandbox de verdade.
   *
   * Perguntar ao Asaas em vez de somar um mes aqui: ele e quem sabe o
   * calendario, e "hoje + 30" erra em todo mes de 31.
   */
  private async ateQuandoVale(
    assinatura: AssinaturaEntity,
  ): Promise<Date | null> {
    try {
      const doAsaas = await this.asaas.buscarAssinatura(
        assinatura.asaasAssinaturaId,
      );
      if (doAsaas.nextDueDate) return this.fimDoDia(doAsaas.nextDueDate);
    } catch {
      // Consulta falhou: melhor manter o acesso anterior do que derrubar o
      // webhook. O Asaas repete o evento, e a proxima tentativa acerta.
      this.log.warn(
        `Nao consegui ler o vencimento de ${assinatura.asaasAssinaturaId}`,
      );
    }
    return assinatura.acessoAte;
  }

  /**
   * O acesso vale o dia inteiro do vencimento.
   *
   * Cortar a zero hora tiraria o app de quem pagou no proprio dia — e o
   * vencimento vem sem hora do Asaas.
   */
  private fimDoDia(data: string): Date {
    return new Date(`${data}T23:59:59.999Z`);
  }
}
