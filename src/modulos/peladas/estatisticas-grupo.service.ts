import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GrupoPeladaEntity } from '../../banco/entidades/grupo-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';

export interface LinhaDestaque {
  jogadorId: string;
  nome: string;
  valor: number;
}

export interface DuplaDestaque {
  nomes: [string, string];
  jogosJuntos: number;
  vitoriasJuntos: number;
  aproveitamento: number;
}

export interface EstatisticasGrupo {
  edicoes: number;
  partidas: number;
  presencaMedia: number;
  maisPresentes: LinhaDestaque[];
  maiorAproveitamento: LinhaDestaque[];
  melhorDupla: DuplaDestaque | null;
}

/** Quantos jogos em comum duas pessoas precisam ter para a dupla contar. */
const MINIMO_JOGOS_DUPLA = 5;
/** Quantas partidas alguem precisa ter para entrar no aproveitamento. */
const MINIMO_PARTIDAS_APROVEITAMENTO = 5;

/**
 * Numeros do grupo ao longo da temporada.
 *
 * Nao e ranking: ranking ordena por pontos e responde quem esta ganhando.
 * Aqui as perguntas sao outras — quem nunca falta, quem mais vence, que dupla
 * funciona junta. Sao as conversas que o grupo tem no WhatsApp, e o app ja tem
 * os dados para resolve-las.
 *
 * Todo recorte exige um minimo de jogos. Sem isso o topo de qualquer lista
 * seria sempre quem jogou uma partida e ganhou: 100% de aproveitamento que nao
 * significa nada.
 */
@Injectable()
export class EstatisticasGrupoService {
  constructor(
    @InjectRepository(GrupoPeladaEntity)
    private readonly grupos: Repository<GrupoPeladaEntity>,
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    @InjectRepository(ParticipacaoPartidaEntity)
    private readonly participacoes: Repository<ParticipacaoPartidaEntity>,
  ) {}

  async doGrupo(
    usuarioId: string,
    grupoId: string,
  ): Promise<EstatisticasGrupo> {
    const grupo = await this.grupos.findOne({
      where: { id: grupoId, organizadorId: usuarioId },
    });
    // 404 e nao 403: um 403 confirmaria que o grupo existe para quem so esta
    // chutando identificadores.
    if (!grupo) throw new NotFoundException('Grupo nao encontrado');

    const edicoes = await this.peladas.find({
      where: { grupoId, deletadoEm: IsNull() },
      select: { id: true },
    });
    if (edicoes.length === 0) return this.vazio(0);

    const idsEdicoes = edicoes.map((e) => e.id);

    // A fonte e a participacao, nao a pontuacao: so ela sabe em QUE time a
    // pessoa jogou, e sem isso nao da para dizer se ela venceu nem quem
    // estava do mesmo lado. O vencedor sai do placar da propria partida.
    //
    // Uma consulta so, agrupando em memoria: sao dezenas de linhas por
    // temporada, e cinco consultas separadas para cinco recortes custariam
    // mais que somar os mesmos dados uma vez.
    const brutas = await this.participacoes
      .createQueryBuilder('pp')
      .innerJoin('partidas', 'pa', 'pa.id = pp.partida_id')
      .innerJoin('participantes_pelada', 'part', 'part.id = pp.participante_id')
      .innerJoin('jogadores', 'j', 'j.id = part.jogador_id')
      .select('part.jogador_id', 'jogadorId')
      .addSelect('j.nome', 'nome')
      .addSelect('pa.pelada_id', 'peladaId')
      .addSelect('pp.partida_id', 'partidaId')
      .addSelect('pp.time_id', 'timeId')
      .addSelect('pa.time_casa_id', 'timeCasaId')
      .addSelect('pa.gols_casa', 'golsCasa')
      .addSelect('pa.gols_visitante', 'golsVisitante')
      .addSelect('pa.vencedor_decisao', 'vencedorDecisao')
      .where('pa.pelada_id IN (:...idsEdicoes)', { idsEdicoes })
      .andWhere('pa.status = :status', { status: 'FINALIZADA' })
      .getRawMany<{
        jogadorId: string;
        nome: string;
        peladaId: string;
        partidaId: string;
        timeId: string | null;
        timeCasaId: string;
        golsCasa: number;
        golsVisitante: number;
        vencedorDecisao: string | null;
      }>();

    const linhas = brutas.map((b) => {
      const ehCasa = b.timeId === b.timeCasaId;
      const empatou = b.golsCasa === b.golsVisitante;
      // No empate resolvido, quem venceu e o lado escolhido pelo organizador.
      const venceu = empatou
        ? b.vencedorDecisao === (ehCasa ? 'CASA' : 'VISITANTE')
        : ehCasa
          ? b.golsCasa > b.golsVisitante
          : b.golsVisitante > b.golsCasa;
      return { ...b, resultado: venceu ? 'VITORIA' : 'OUTRO' };
    });

    if (linhas.length === 0) return this.vazio(edicoes.length);

    const partidas = new Set(linhas.map((l) => l.partidaId)).size;

    const porJogador = new Map<
      string,
      { nome: string; peladas: Set<string>; jogos: number; vitorias: number }
    >();
    for (const linha of linhas) {
      const atual = porJogador.get(linha.jogadorId) ?? {
        nome: linha.nome,
        peladas: new Set<string>(),
        jogos: 0,
        vitorias: 0,
      };
      atual.peladas.add(linha.peladaId);
      atual.jogos += 1;
      if (linha.resultado === 'VITORIA') atual.vitorias += 1;
      porJogador.set(linha.jogadorId, atual);
    }

    const maisPresentes = [...porJogador.entries()]
      .map(([jogadorId, d]) => ({
        jogadorId,
        nome: d.nome,
        valor: d.peladas.size,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    const maiorAproveitamento = [...porJogador.entries()]
      .filter(([, d]) => d.jogos >= MINIMO_PARTIDAS_APROVEITAMENTO)
      .map(([jogadorId, d]) => ({
        jogadorId,
        nome: d.nome,
        valor: Math.round((d.vitorias / d.jogos) * 100),
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    return {
      edicoes: edicoes.length,
      partidas,
      presencaMedia:
        edicoes.length > 0
          ? Math.round(
              [...porJogador.values()].reduce(
                (soma, d) => soma + d.peladas.size,
                0,
              ) / edicoes.length,
            )
          : 0,
      maisPresentes,
      maiorAproveitamento,
      melhorDupla: this.melhorDupla(linhas),
    };
  }

  /**
   * Dupla que mais vence junta, entre quem jogou junto o suficiente.
   *
   * "Junto" e estar no MESMO time na MESMA partida — nao basta terem aparecido
   * na mesma pelada, senao a lista viraria quem mais frequenta.
   */
  private melhorDupla(
    linhas: {
      jogadorId: string;
      nome: string;
      partidaId: string;
      timeId: string | null;
      resultado: string | null;
    }[],
  ): DuplaDestaque | null {
    const porTimeNaPartida = new Map<
      string,
      { jogadores: { id: string; nome: string }[]; venceu: boolean }
    >();

    for (const linha of linhas) {
      if (!linha.timeId) continue;
      const chave = `${linha.partidaId}:${linha.timeId}`;
      const atual = porTimeNaPartida.get(chave) ?? {
        jogadores: [],
        venceu: linha.resultado === 'VITORIA',
      };
      atual.jogadores.push({ id: linha.jogadorId, nome: linha.nome });
      porTimeNaPartida.set(chave, atual);
    }

    const duplas = new Map<
      string,
      { nomes: [string, string]; jogos: number; vitorias: number }
    >();

    for (const time of porTimeNaPartida.values()) {
      const ordenados = [...time.jogadores].sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      for (let i = 0; i < ordenados.length; i++) {
        for (let j = i + 1; j < ordenados.length; j++) {
          const chave = `${ordenados[i].id}|${ordenados[j].id}`;
          const atual = duplas.get(chave) ?? {
            nomes: [ordenados[i].nome, ordenados[j].nome] as [string, string],
            jogos: 0,
            vitorias: 0,
          };
          atual.jogos += 1;
          if (time.venceu) atual.vitorias += 1;
          duplas.set(chave, atual);
        }
      }
    }

    const elegiveis = [...duplas.values()]
      .filter((d) => d.jogos >= MINIMO_JOGOS_DUPLA)
      .map((d) => ({
        nomes: d.nomes,
        jogosJuntos: d.jogos,
        vitoriasJuntos: d.vitorias,
        aproveitamento: Math.round((d.vitorias / d.jogos) * 100),
      }))
      // Desempata por jogos: entre dois aproveitamentos iguais, vale mais o
      // que se sustentou por mais partidas.
      .sort(
        (a, b) =>
          b.aproveitamento - a.aproveitamento || b.jogosJuntos - a.jogosJuntos,
      );

    return elegiveis[0] ?? null;
  }

  private vazio(edicoes: number): EstatisticasGrupo {
    return {
      edicoes,
      partidas: 0,
      presencaMedia: 0,
      maisPresentes: [],
      maiorAproveitamento: [],
      melhorDupla: null,
    };
  }
}
