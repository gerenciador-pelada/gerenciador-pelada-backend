import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GrupoPeladaEntity } from '../../banco/entidades/grupo-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';

export interface DestaqueDaNoite {
  nome: string;
  total: number;
}

export interface EdicaoNoHistorico {
  peladaId: string;
  dataHora: string;
  local: string | null;
  status: StatusPelada;
  /** Quem realmente apareceu — confirmar presenca nao e chegar. */
  presentes: number;
  partidas: number;
  gols: number;
  artilheiro: DestaqueDaNoite | null;
  bolaCheia: DestaqueDaNoite | null;
}

interface LinhaAgregada {
  peladaId: string;
  partidas: string;
  gols: string;
}

interface LinhaPresenca {
  peladaId: string;
  presentes: string;
}

interface LinhaDestaque {
  peladaId: string;
  nome: string;
  tipo: string;
  total: string;
}

const paraNumero = (valor: string | null | undefined): number =>
  valor === null || valor === undefined ? 0 : Number(valor);

/**
 * O historico do grupo, uma linha por edicao.
 *
 * Nao confundir com `HistoricoService`, que e log de auditoria — acoes com
 * horario, feito para desfazer. Aqui a pergunta e outra: "o que aconteceu
 * naquela noite". Placar, quem apareceu, quem fez gol.
 *
 * Endpoint proprio em vez de montar no cliente porque a alternativa seria uma
 * requisicao por edicao: um grupo com duas temporadas passaria de cinquenta
 * chamadas para desenhar uma lista.
 *
 * Quatro consultas agrupadas, e nao uma por edicao pelo mesmo motivo. O
 * cruzamento acontece em memoria: sao dezenas de linhas, e o custo de somar
 * de novo e menor que o de ir ao banco outra vez.
 */
@Injectable()
export class HistoricoGrupoService {
  constructor(
    @InjectRepository(GrupoPeladaEntity)
    private readonly grupos: Repository<GrupoPeladaEntity>,
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
  ) {}

  async doGrupo(
    usuarioId: string,
    grupoId: string,
  ): Promise<EdicaoNoHistorico[]> {
    const grupo = await this.grupos.findOne({
      where: { id: grupoId, organizadorId: usuarioId },
    });
    // 404 e nao 403: um 403 confirmaria que o grupo existe para quem so esta
    // chutando identificadores.
    if (!grupo) throw new NotFoundException('Grupo nao encontrado');

    const edicoes = await this.peladas.find({
      where: { grupoId, deletadoEm: IsNull() },
      relations: { local: true },
      order: { dataHora: 'DESC' },
    });
    if (edicoes.length === 0) return [];

    const ids = edicoes.map((e) => e.id);
    const [placares, presencas, destaques] = await Promise.all([
      this.somarPartidas(ids),
      this.contarPresentes(ids),
      this.buscarDestaques(ids),
    ]);

    return edicoes.map((edicao) => {
      const placar = placares.get(edicao.id);
      const dosDestaques = destaques.get(edicao.id) ?? [];
      const melhor = (tipo: string): DestaqueDaNoite | null => {
        const linhas = dosDestaques.filter((d) => d.tipo === tipo);
        if (linhas.length === 0) return null;
        // Empate resolve pelo primeiro: a consulta ja veio ordenada por total
        // e nome, entao o resultado e estavel entre chamadas.
        const topo = linhas[0];
        return { nome: topo.nome, total: paraNumero(topo.total) };
      };

      return {
        peladaId: edicao.id,
        dataHora: edicao.dataHora.toISOString(),
        local: edicao.local?.nome ?? null,
        status: edicao.status,
        presentes: presencas.get(edicao.id) ?? 0,
        partidas: paraNumero(placar?.partidas),
        gols: paraNumero(placar?.gols),
        artilheiro: melhor('GOL'),
        bolaCheia: melhor('BOLA_CHEIA'),
      };
    });
  }

  /** Partidas finalizadas e gols marcados nelas, por edicao. */
  private async somarPartidas(
    ids: string[],
  ): Promise<Map<string, LinhaAgregada>> {
    const linhas = await this.peladas.manager
      .createQueryBuilder()
      .from('partidas', 'pa')
      .select('pa.pelada_id', 'peladaId')
      .addSelect('COUNT(pa.id)', 'partidas')
      .addSelect('COALESCE(SUM(pa.gols_casa + pa.gols_visitante), 0)', 'gols')
      .where('pa.pelada_id IN (:...ids)', { ids })
      .andWhere('pa.status = :status', { status: 'FINALIZADA' })
      .groupBy('pa.pelada_id')
      .getRawMany<LinhaAgregada>();

    return new Map(linhas.map((l) => [l.peladaId, l]));
  }

  /**
   * Quem apareceu, por edicao.
   *
   * O criterio e `chegada_em`, nao o status: status muda ao longo da noite —
   * quem jogou e saiu vira DESCANSANDO — e contar por ele daria numeros
   * diferentes conforme a hora em que a tela fosse aberta. Ter chegado e um
   * fato que nao volta atras.
   */
  private async contarPresentes(ids: string[]): Promise<Map<string, number>> {
    const linhas = await this.peladas.manager
      .createQueryBuilder()
      .from('participantes_pelada', 'p')
      .select('p.pelada_id', 'peladaId')
      .addSelect('COUNT(p.id)', 'presentes')
      .where('p.pelada_id IN (:...ids)', { ids })
      .andWhere('p.chegada_em IS NOT NULL')
      .groupBy('p.pelada_id')
      .getRawMany<LinhaPresenca>();

    return new Map(linhas.map((l) => [l.peladaId, paraNumero(l.presentes)]));
  }

  /** Artilheiro e bola cheia de cada noite, ja ordenados. */
  private async buscarDestaques(
    ids: string[],
  ): Promise<Map<string, LinhaDestaque[]>> {
    const linhas = await this.peladas.manager
      .createQueryBuilder()
      .from('eventos_partida', 'e')
      .innerJoin('partidas', 'pa', 'pa.id = e.partida_id')
      .innerJoin('participantes_pelada', 'part', 'part.id = e.participante_id')
      .innerJoin('jogadores', 'j', 'j.id = part.jogador_id')
      .select('pa.pelada_id', 'peladaId')
      .addSelect('COALESCE(j.apelido, j.nome)', 'nome')
      .addSelect('e.tipo', 'tipo')
      .addSelect('COUNT(e.id)', 'total')
      .where('pa.pelada_id IN (:...ids)', { ids })
      .andWhere('e.tipo IN (:...tipos)', { tipos: ['GOL', 'BOLA_CHEIA'] })
      // Evento apagado numa correcao nao pode continuar coroando artilheiro.
      .andWhere('e.deletado_em IS NULL')
      .groupBy('pa.pelada_id')
      .addGroupBy('j.apelido')
      .addGroupBy('j.nome')
      .addGroupBy('e.tipo')
      .orderBy('COUNT(e.id)', 'DESC')
      .addOrderBy('COALESCE(j.apelido, j.nome)', 'ASC')
      .getRawMany<LinhaDestaque>();

    const porPelada = new Map<string, LinhaDestaque[]>();
    for (const linha of linhas) {
      porPelada.set(linha.peladaId, [
        ...(porPelada.get(linha.peladaId) ?? []),
        linha,
      ]);
    }
    return porPelada;
  }
}
