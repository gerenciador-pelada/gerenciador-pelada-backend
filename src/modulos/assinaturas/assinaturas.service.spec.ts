import { Repository } from 'typeorm';
import { AssinaturaEntity } from '../../banco/entidades/assinatura.entity';
import { UsuarioEntity } from '../../banco/entidades/usuario.entity';
import { StatusAssinatura } from '../../comum/enums/status-assinatura.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { AssinaturasService } from './assinaturas.service';
import { ClienteAsaas } from './cliente-asaas';

const USUARIO = 'usuario-1';

function montar(assinaturaAtual: Partial<AssinaturaEntity> | null = null) {
  const salvos: Partial<AssinaturaEntity>[] = [];
  const assinaturas = {
    findOne: jest.fn().mockResolvedValue(assinaturaAtual),
    create: jest.fn().mockImplementation((d: unknown) => d),
    save: jest.fn().mockImplementation((d: Partial<AssinaturaEntity>) => {
      salvos.push({ ...d });
      return Promise.resolve(d);
    }),
  } as unknown as Repository<AssinaturaEntity>;

  const usuarios = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: USUARIO, nome: 'Ana', email: 'a@b.com' }),
  } as unknown as Repository<UsuarioEntity>;

  const asaas = {
    habilitado: true,
    criarCliente: jest.fn().mockResolvedValue({ id: 'cus_1' }),
    criarAssinatura: jest.fn().mockResolvedValue({ id: 'sub_1' }),
    // O fim do ciclo vem da assinatura no Asaas, nao do evento.
    buscarAssinatura: jest
      .fn()
      .mockResolvedValue({ id: 'sub_1', nextDueDate: '2026-09-05' }),
    cancelarAssinatura: jest.fn().mockResolvedValue(undefined),
  } as unknown as ClienteAsaas;

  return {
    servico: new AssinaturasService(assinaturas, usuarios, asaas),
    salvos,
    asaas,
  };
}

describe('AssinaturasService', () => {
  describe('assinar', () => {
    it('nasce vencida e sem acesso ate o pagamento confirmar', async () => {
      const { servico, salvos, asaas } = montar();

      await servico.assinar(USUARIO, {
        cpfCnpj: '123.456.789-09',
        plano: 'MENSAL' as const,
      });

      // O preco vem da tabela do servidor: o cliente so escolhe o plano.
      // Nascer ATIVA daria um ciclo de graca a cada nova assinatura.
      expect(salvos[0]).toMatchObject({
        status: StatusAssinatura.VENCIDA,
        acessoAte: null,
        asaasAssinaturaId: 'sub_1',
      });
      // Centavos viram reais na borda, e o documento vai so com digitos.
      expect(asaas.criarAssinatura).toHaveBeenCalledWith(
        expect.objectContaining({ value: 19.9, externalReference: USUARIO }),
      );
      expect(asaas.criarCliente).toHaveBeenCalledWith(
        expect.objectContaining({ cpfCnpj: '12345678909' }),
      );
    });

    it('recusa uma segunda assinatura enquanto a atual vale', async () => {
      const { servico, asaas } = montar({
        id: 'a1',
        status: StatusAssinatura.ATIVA,
      });

      await expect(
        servico.assinar(USUARIO, {
          cpfCnpj: '12345678909',
          plano: 'MENSAL' as const,
        }),
      ).rejects.toThrow(/ja tem uma assinatura/i);
      // Cobranca dobrada e o pior erro possivel aqui: nem chega no Asaas.
      expect(asaas.criarAssinatura).not.toHaveBeenCalled();
    });

    it('reaproveita o cliente do Asaas ao reassinar depois de cancelar', async () => {
      const { servico, asaas } = montar({
        id: 'a1',
        status: StatusAssinatura.CANCELADA,
        asaasClienteId: 'cus_existente',
      });

      await servico.assinar(USUARIO, {
        cpfCnpj: '12345678909',
        plano: 'MENSAL' as const,
      });

      expect(asaas.criarCliente).not.toHaveBeenCalled();
      expect(asaas.criarAssinatura).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existente' }),
      );
    });

    it('recusa documento que nao e CPF nem CNPJ', async () => {
      const { servico } = montar();

      await expect(
        servico.assinar(USUARIO, {
          cpfCnpj: '123',
          plano: 'MENSAL' as const,
        }),
      ).rejects.toThrow(ErroRegraPelada);
    });
  });

  describe('aplicarEvento', () => {
    it('libera o acesso ate o FIM DO CICLO, nao ate a cobranca paga', async () => {
      const { servico, salvos } = montar({
        id: 'a1',
        status: StatusAssinatura.VENCIDA,
        acessoAte: null,
      });

      // A cobranca paga vencia em 05/08; o ciclo que ela paga vai ate 05/09.
      // Usar a data do evento dava acesso ate o fim do mesmo dia.
      const r = await servico.aplicarEvento({
        event: 'PAYMENT_CONFIRMED',
        payment: { subscription: 'sub_1', dueDate: '2026-08-05' },
      });

      expect(r.aplicado).toBe(true);
      expect(salvos[0].status).toBe(StatusAssinatura.ATIVA);
      // Fim do dia: cortar a zero hora tiraria o app de quem pagou no dia.
      expect(salvos[0].acessoAte?.toISOString()).toBe(
        '2026-09-05T23:59:59.999Z',
      );
    });

    it('repetir o mesmo evento nao estende o acesso', async () => {
      const { servico, salvos } = montar({
        id: 'a1',
        status: StatusAssinatura.ATIVA,
        acessoAte: new Date('2026-09-05T23:59:59.999Z'),
      });

      // O Asaas repete ate receber 200; a segunda vez tem que ser inofensiva.
      await servico.aplicarEvento({
        event: 'PAYMENT_CONFIRMED',
        payment: { subscription: 'sub_1' },
      });
      await servico.aplicarEvento({
        event: 'PAYMENT_CONFIRMED',
        payment: { subscription: 'sub_1' },
      });

      expect(salvos[0].acessoAte?.toISOString()).toBe(
        salvos[1].acessoAte?.toISOString(),
      );
    });

    it('marca vencida quando a cobranca fura', async () => {
      const { servico, salvos } = montar({
        id: 'a1',
        status: StatusAssinatura.ATIVA,
      });

      await servico.aplicarEvento({
        event: 'PAYMENT_OVERDUE',
        payment: { subscription: 'sub_1' },
      });

      expect(salvos[0].status).toBe(StatusAssinatura.VENCIDA);
    });

    it('ignora evento de assinatura que este servidor nao conhece', async () => {
      const { servico, salvos } = montar(null);

      const r = await servico.aplicarEvento({
        event: 'PAYMENT_CONFIRMED',
        payment: { subscription: 'sub_de_outro_ambiente' },
      });

      // Responder erro faria o Asaas repetir para sempre.
      expect(r.aplicado).toBe(false);
      expect(salvos).toHaveLength(0);
    });

    it('ignora evento que nao mexe em acesso', async () => {
      const { servico, salvos } = montar({
        id: 'a1',
        status: StatusAssinatura.ATIVA,
      });

      const r = await servico.aplicarEvento({
        event: 'PAYMENT_UPDATED',
        payment: { subscription: 'sub_1' },
      });

      expect(r.aplicado).toBe(false);
      expect(salvos).toHaveLength(0);
    });
  });

  describe('cancelar', () => {
    it('mantem o acesso do ciclo ja pago', async () => {
      const acessoAte = new Date('2026-09-05T23:59:59.999Z');
      const { servico, salvos } = montar({
        id: 'a1',
        status: StatusAssinatura.ATIVA,
        asaasAssinaturaId: 'sub_1',
        acessoAte,
      });

      await servico.cancelar(USUARIO);

      // Receber por um mes e entregar meio seria o comportamento errado.
      expect(salvos[0]).toMatchObject({
        status: StatusAssinatura.CANCELADA,
        acessoAte,
      });
    });
  });
});
