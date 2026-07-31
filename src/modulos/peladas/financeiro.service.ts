import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';

export interface LinhaAcerto {
  participanteId: string;
  nome: string;
  apelido: string | null;
  ehGoleiroFixo: boolean;
  /** Quanto esta pessoa deve, em centavos. Zero para quem e isento. */
  deveCentavos: number;
  isento: boolean;
  pagou: boolean;
}

export interface AcertoPelada {
  valorCampoCentavos: number | null;
  goleiroFixoPaga: boolean;
  /** Quantas pessoas dividem a conta. */
  pagantes: number;
  /** Valor base por cabeca, em centavos. */
  porCabecaCentavos: number;
  /**
   * Sobra da divisao, em centavos, distribuida entre os primeiros pagantes.
   * Exposta para a tela poder explicar por que alguem paga um centavo a mais.
   */
  restoCentavos: number;
  arrecadadoCentavos: number;
  faltaCentavos: number;
  participantes: LinhaAcerto[];
}

/**
 * Acerto do aluguel do campo depois da pelada.
 *
 * Divide o custo entre quem de fato apareceu — nao entre quem foi convidado.
 * Quem confirmou e nao veio nao deve nada, e quem chegou e saiu machucado no
 * primeiro minuto deve igual: o que se paga e o campo, nao o tempo em quadra.
 */
@Injectable()
export class FinanceiroService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    @InjectRepository(ParticipantePeladaEntity)
    private readonly participantes: Repository<ParticipantePeladaEntity>,
  ) {}

  async resumo(usuarioId: string, peladaId: string): Promise<AcertoPelada> {
    const pelada = await this.carregar(usuarioId, peladaId);

    const presentes = await this.participantes.find({
      where: { peladaId, ordemChegada: Not(IsNull()) },
      relations: ['jogador'],
      order: { ordemChegada: 'ASC' },
    });

    const isento = (p: ParticipantePeladaEntity) =>
      p.ehGoleiroFixo && !pelada.goleiroFixoPaga;

    const pagantes = presentes.filter((p) => !isento(p));
    const total = pelada.valorCampoCentavos ?? 0;

    // Divisao inteira mais resto: se sobra 1 centavo em tres pessoas, alguem
    // paga um centavo a mais. Distribuir o resto pelos primeiros e melhor que
    // arredondar todo mundo para cima — assim a soma bate exatamente com o
    // valor do campo, sem sobra nem falta artificial.
    const porCabeca = pagantes.length > 0 ? Math.floor(total / pagantes.length) : 0;
    const resto = pagantes.length > 0 ? total % pagantes.length : 0;

    const deveDe = new Map<string, number>();
    pagantes.forEach((p, indice) => {
      deveDe.set(p.id, porCabeca + (indice < resto ? 1 : 0));
    });

    const linhas: LinhaAcerto[] = presentes.map((p) => ({
      participanteId: p.id,
      nome: p.jogador?.nome ?? 'Sem nome',
      apelido: p.jogador?.apelido ?? null,
      ehGoleiroFixo: p.ehGoleiroFixo,
      deveCentavos: deveDe.get(p.id) ?? 0,
      isento: isento(p),
      pagou: p.pagou,
    }));

    const arrecadado = linhas
      .filter((l) => l.pagou)
      .reduce((soma, l) => soma + l.deveCentavos, 0);

    return {
      valorCampoCentavos: pelada.valorCampoCentavos,
      goleiroFixoPaga: pelada.goleiroFixoPaga,
      pagantes: pagantes.length,
      porCabecaCentavos: porCabeca,
      restoCentavos: resto,
      arrecadadoCentavos: arrecadado,
      faltaCentavos: total - arrecadado,
      participantes: linhas,
    };
  }

  async definirValor(
    usuarioId: string,
    peladaId: string,
    dados: { valorCampoCentavos?: number | null; goleiroFixoPaga?: boolean },
  ): Promise<AcertoPelada> {
    await this.carregar(usuarioId, peladaId);

    const atualizacao: Partial<PeladaEntity> = {};
    if (dados.valorCampoCentavos !== undefined)
      atualizacao.valorCampoCentavos = dados.valorCampoCentavos;
    if (dados.goleiroFixoPaga !== undefined)
      atualizacao.goleiroFixoPaga = dados.goleiroFixoPaga;

    if (Object.keys(atualizacao).length > 0)
      await this.peladas.update(peladaId, atualizacao);

    return this.resumo(usuarioId, peladaId);
  }

  async marcarPagamento(
    usuarioId: string,
    peladaId: string,
    participanteId: string,
    pagou: boolean,
  ): Promise<AcertoPelada> {
    await this.carregar(usuarioId, peladaId);

    const participante = await this.participantes.findOne({
      where: { id: participanteId, peladaId },
    });
    if (!participante)
      throw new NotFoundException('Participante nao encontrado');

    if (participante.ordemChegada === null)
      throw new ErroRegraPelada(
        'PARTICIPANTE_AUSENTE',
        'Quem nao chegou nao entra no rateio',
      );

    await this.participantes.update(participanteId, { pagou });
    return this.resumo(usuarioId, peladaId);
  }

  private async carregar(
    usuarioId: string,
    peladaId: string,
  ): Promise<PeladaEntity> {
    // 404 e nao 403: um 403 confirmaria que a pelada existe para quem so
    // esta chutando identificadores.
    const pelada = await this.peladas.findOne({
      where: { id: peladaId, organizadorId: usuarioId, deletadoEm: IsNull() },
    });
    if (!pelada) throw new NotFoundException('Pelada nao encontrada');
    return pelada;
  }
}
