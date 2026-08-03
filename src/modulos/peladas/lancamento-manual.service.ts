import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { PontuacaoJogadorEntity } from '../../banco/entidades/pontuacao-jogador.entity';
import { TimeEntity } from '../../banco/entidades/time.entity';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';

export interface LinhaLancamento {
  jogadorId: string;
  gols?: number;
  assistencias?: number;
  bolasCheias?: number;
  bolasMurchas?: number;
  pontos?: number;
}

/**
 * Lancamento de uma pelada que aconteceu antes do app.
 *
 * O organizador tem so o consolidado por jogador — gols, assistencias, pontos
 * — e nao o jogo a jogo. Sem um caminho para isso, o ranking da temporada
 * comeca zerado e ignora o historico real do grupo.
 *
 * O ranking le de duas fontes, ambas chaveadas por partida: pontos de
 * `PontuacaoJogador`, e contagens de `EventoPartida`. Nao existe como dizer
 * "fulano fez 3 gols nesta pelada" sem uma partida onde pendurar os registros.
 *
 * Por isso o lancamento cria UMA partida sintetica ja finalizada e escreve os
 * registros de sempre nela. A alternativa — uma tabela de ajustes somada ao
 * ranking no fim — seria mais barata e pior: criaria uma terceira versao da
 * verdade, divergente das duas que ja existem, e ninguem saberia explicar o
 * numero tres meses depois.
 */
@Injectable()
export class LancamentoManualService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    @InjectRepository(JogadorEntity)
    private readonly jogadores: Repository<JogadorEntity>,
    private readonly fonteDados: DataSource,
  ) {}

  async lancar(
    usuarioId: string,
    peladaId: string,
    linhas: LinhaLancamento[],
  ): Promise<{ participantes: number; partidaId: string }> {
    const pelada = await this.peladas.findOne({
      where: { id: peladaId, organizadorId: usuarioId, deletadoEm: IsNull() },
    });
    // 404 e nao 403: um 403 confirmaria que a pelada existe para quem so esta
    // chutando identificadores.
    if (!pelada) throw new NotFoundException('Pelada nao encontrada');

    if (linhas.length === 0)
      throw new ErroRegraPelada(
        'LANCAMENTO_VAZIO',
        'Informe ao menos um jogador',
      );

    const ids = linhas.map((l) => l.jogadorId);
    if (new Set(ids).size !== ids.length)
      throw new ErroRegraPelada(
        'JOGADOR_REPETIDO',
        'Cada jogador pode aparecer uma vez so',
      );

    const encontrados = await this.jogadores.find({
      where: ids.map((id) => ({ id, usuarioId })),
    });
    if (encontrados.length !== ids.length)
      throw new NotFoundException('Algum jogador nao foi encontrado');

    return this.fonteDados.transaction(async (gerenciador) => {
      // Recusa relancar: rodar duas vezes dobraria os numeros em silencio, e
      // o organizador so descobriria olhando o ranking semanas depois.
      const jaTem = await gerenciador.count(PartidaEntity, {
        where: { peladaId },
      });
      if (jaTem > 0)
        throw new ErroRegraPelada(
          'PELADA_JA_TEM_PARTIDAS',
          'Esta pelada ja tem partidas: o lancamento manual e so para edicoes sem registro',
        );

      // Um time so, de fachada. Os numeros vieram somados, sem informacao de
      // quem jogou contra quem — inventar dois lados criaria confrontos que
      // nunca existiram.
      const time = await gerenciador.save(
        gerenciador.create(TimeEntity, {
          peladaId,
          nome: 'Lancamento manual',
          cor: null,
          ordemCriacao: 1,
          ativo: false,
          dissolvidoEm: new Date(),
        }),
      );

      const partida = await gerenciador.save(
        gerenciador.create(PartidaEntity, {
          peladaId,
          numero: 1,
          timeCasaId: time.id,
          timeVisitanteId: time.id,
          golsCasa: 0,
          golsVisitante: 0,
          status: StatusPartida.FINALIZADA,
          iniciadaEm: pelada.dataHora,
          finalizadaEm: pelada.dataHora,
        }),
      );

      let ordem = 0;
      for (const linha of linhas) {
        ordem += 1;
        const participante = await gerenciador.save(
          gerenciador.create(ParticipantePeladaEntity, {
            peladaId,
            jogadorId: linha.jogadorId,
            status: StatusParticipantePelada.PRESENTE,
            ordemChegada: ordem,
            chegadaEm: pelada.dataHora,
            ehGoleiroFixo: false,
          }),
        );

        await gerenciador.save(
          gerenciador.create(ParticipacaoPartidaEntity, {
            partidaId: partida.id,
            participanteId: participante.id,
            timeId: time.id,
            ehGoleiro: false,
            saiuEm: null,
            minutosJogados: null,
          }),
        );

        // Uma linha de evento por unidade contada. E o que faz gols e
        // assistencias aparecerem no ranking, que conta eventos e nao le a
        // pontuacao.
        const eventos: { tipo: TipoEventoPartida; quantidade: number }[] = [
          { tipo: TipoEventoPartida.GOL, quantidade: linha.gols ?? 0 },
          {
            tipo: TipoEventoPartida.BOLA_CHEIA,
            quantidade: linha.bolasCheias ?? 0,
          },
          {
            tipo: TipoEventoPartida.BOLA_MURCHA,
            quantidade: linha.bolasMurchas ?? 0,
          },
        ];

        for (const { tipo, quantidade } of eventos) {
          for (let i = 0; i < quantidade; i++) {
            await gerenciador.save(
              gerenciador.create(EventoPartidaEntity, {
                partidaId: partida.id,
                participanteId: participante.id,
                participanteRelacionadoId: null,
                timeId: time.id,
                tipo,
                minuto: null,
                registradoPorId: usuarioId,
              }),
            );
          }
        }

        await gerenciador.save(
          gerenciador.create(PontuacaoJogadorEntity, {
            peladaId,
            partidaId: partida.id,
            participanteId: participante.id,
            jogadorId: linha.jogadorId,
            pontosVitoria: 0,
            pontosGols: 0,
            pontosAssistencias: 0,
            pontosBolaCheia: 0,
            pontosBolaMurcha: 0,
            // O total informado entra inteiro, sem tentar decompor: como os
            // pontos foram somados a mao, nao ha como saber de onde vieram, e
            // inventar a origem daria um detalhamento falso.
            pontosTotal: linha.pontos ?? 0,
          }),
        );
      }

      await this.anotarAssistencias(gerenciador, linhas, partida.id, peladaId);

      await gerenciador.update(PeladaEntity, peladaId, {
        status: StatusPelada.FINALIZADA,
      });

      return { participantes: linhas.length, partidaId: partida.id };
    });
  }

  /**
   * Apaga um lancamento manual inteiro, devolvendo a edicao ao estado de antes.
   *
   * E o unico jeito de corrigir um lancamento errado. Editar no lugar nao
   * serve: os pontos entram somados a mao, e qualquer correcao de evento
   * dispara `recalcularPontuacao`, que refaz a pontuacao pelas regras da
   * pelada e apaga o total digitado. Melhor apagar tudo e lancar de novo com
   * os numeros certos do que deixar duas fontes se contradizerem.
   */
  async desfazer(
    usuarioId: string,
    peladaId: string,
  ): Promise<{ partidaId: string; participantes: number }> {
    const pelada = await this.peladas.findOne({
      where: { id: peladaId, organizadorId: usuarioId, deletadoEm: IsNull() },
    });
    if (!pelada) throw new NotFoundException('Pelada nao encontrada');

    return this.fonteDados.transaction(async (gerenciador) => {
      const partidas = await gerenciador.find(PartidaEntity, {
        where: { peladaId },
      });

      // A assinatura do lancamento manual: uma unica partida com o mesmo time
      // dos dois lados. Um sorteio de verdade sempre cria dois times, entao
      // esta checagem nunca alcanca uma pelada jogada — e e por isso que ela
      // olha a forma, e nao o nome do time, que o organizador pode renomear.
      const manual = partidas.find((p) => p.timeCasaId === p.timeVisitanteId);
      if (partidas.length !== 1 || !manual)
        throw new ErroRegraPelada(
          'SEM_LANCAMENTO_MANUAL',
          'Esta pelada nao tem um lancamento manual para desfazer',
        );

      const participacoes = await gerenciador.find(ParticipacaoPartidaEntity, {
        where: { partidaId: manual.id },
      });
      const idsParticipantes = participacoes.map((p) => p.participanteId);

      // Ordem ditada pelas chaves estrangeiras: o evento aponta para o
      // participante com RESTRICT, entao ele sai primeiro.
      await gerenciador.delete(PontuacaoJogadorEntity, {
        partidaId: manual.id,
      });
      await gerenciador.delete(EventoPartidaEntity, { partidaId: manual.id });
      await gerenciador.delete(ParticipacaoPartidaEntity, {
        partidaId: manual.id,
      });
      await gerenciador.delete(PartidaEntity, { id: manual.id });
      await gerenciador.delete(TimeEntity, { id: manual.timeCasaId });
      // So quem o lancamento criou. Se o organizador tinha adicionado alguem
      // antes, essa pessoa nao participou da partida sintetica e fica.
      if (idsParticipantes.length)
        await gerenciador.delete(ParticipantePeladaEntity, {
          id: In(idsParticipantes),
        });

      await gerenciador.update(PeladaEntity, peladaId, {
        status: StatusPelada.ABERTA_INSCRICOES,
      });

      return {
        partidaId: manual.id,
        participantes: idsParticipantes.length,
      };
    });
  }

  /**
   * Anota as assistencias nos gols que ja existem.
   *
   * O contador de assistencia le `participanteRelacionadoId` de eventos de
   * GOL. Criar um evento novo por assistencia inflaria os gols de quem
   * assistiu — foi o primeiro caminho que tentei, e ele conta a mesma jogada
   * duas vezes. Aqui os gols ja foram gravados: a assistencia so preenche o
   * campo relacionado de um deles.
   *
   * Nao ha como saber quem assistiu quem, entao a distribuicao e arbitraria.
   * O total por pessoa — que e o dado que o organizador tem — sai exato.
   */
  private async anotarAssistencias(
    gerenciador: EntityManager,
    linhas: LinhaLancamento[],
    partidaId: string,
    peladaId: string,
  ): Promise<void> {
    const total = linhas.reduce((s, l) => s + (l.assistencias ?? 0), 0);
    if (total === 0) return;

    const participantes = await gerenciador.find(ParticipantePeladaEntity, {
      where: { peladaId },
    });
    const porJogador = new Map(participantes.map((p) => [p.jogadorId, p.id]));

    const gols = await gerenciador.find(EventoPartidaEntity, {
      where: { partidaId, tipo: TipoEventoPartida.GOL },
    });

    // Assistencia so existe se houve gol. Mais assistencias que gols nao e
    // representavel — e quase sempre erro de digitacao, entao recusar e
    // melhor que gravar um numero que o ranking nunca vai mostrar inteiro.
    if (total > gols.length)
      throw new ErroRegraPelada(
        'ASSISTENCIAS_ALEM_DOS_GOLS',
        'Ha mais assistencias que gols: cada assistencia precisa de um gol',
        { gols: gols.length, assistencias: total },
      );

    const usados = new Set<string>();

    for (const linha of linhas) {
      const participanteId = porJogador.get(linha.jogadorId);
      if (!participanteId) continue;

      for (let i = 0; i < (linha.assistencias ?? 0); i++) {
        // Varre a lista inteira a cada assistencia, e nao com um indice que so
        // avanca: com o cursor unico, quem vinha depois nao alcancava os gols
        // livres que ficaram para tras e perdia a assistencia em silencio.
        //
        // Pula o proprio gol — ninguem assiste a si mesmo, e o contador
        // somaria gol e assistencia para a mesma pessoa na mesma jogada.
        const alvo = gols.find(
          (gol) => !usados.has(gol.id) && gol.participanteId !== participanteId,
        );
        if (!alvo)
          throw new ErroRegraPelada(
            'ASSISTENCIA_SEM_GOL_DISPONIVEL',
            'Nao ha gol de outro jogador para atribuir a assistencia',
            { jogadorId: linha.jogadorId },
          );

        usados.add(alvo.id);
        await gerenciador.update(EventoPartidaEntity, alvo.id, {
          participanteRelacionadoId: participanteId,
        });
      }
    }
  }
}
