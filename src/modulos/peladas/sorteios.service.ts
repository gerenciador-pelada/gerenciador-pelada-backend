import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { JogadorTimeEntity } from '../../banco/entidades/jogador-time.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { TimeEntity } from '../../banco/entidades/time.entity';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { MaquinaStatusPelada } from '../../dominio/pelada/maquina-status-pelada';
import {
  JogadorSorteio,
  SorteadorAleatorio,
} from '../../dominio/pelada/sorteador-aleatorio';

@Injectable()
export class SorteiosService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    @InjectRepository(ParticipantePeladaEntity)
    private readonly participantes: Repository<ParticipantePeladaEntity>,
    private readonly fonteDados: DataSource,
  ) {}

  /**
   * Sorteia os dois primeiros times e cria a partida inicial.
   *
   * Tudo roda numa transacao unica: se a criacao da partida falhar, os times e
   * a fila nao ficam gravados pela metade. Antes desta versao o resultado do
   * sorteio existia apenas na resposta HTTP e os times se perdiam.
   *
   * Refazer o sorteio e permitido enquanto a partida 1 estiver AGUARDANDO: os
   * times e a partida anteriores sao descartados e o sorteio roda de novo.
   */
  async sortear(usuarioId: string, peladaId: string) {
    const pelada = await this.peladas.findOne({
      where: { id: peladaId, organizadorId: usuarioId },
      relations: ['configuracao'],
    });
    if (!pelada) throw new NotFoundException('Pelada nao encontrada');

    // Sortear os primeiros times E o ato de comecar a pelada. Exigir uma
    // transicao de status separada antes criava um passo invisivel: a pelada
    // nascia ABERTA_INSCRICOES e o sorteio recusava, por mais gente presente
    // que houvesse. A maquina de status continua governando a transicao.
    //
    // A gravacao do novo status vai junto com o sorteio, dentro da transacao.
    // Gravar antes deixava a pelada EM_ANDAMENTO sem nenhuma partida quando o
    // sorteio falhava por falta de gente — e nesse estado o proprio sorteio
    // inicial ficava inalcancavel, travando a edicao para sempre.
    const vaiComecarAgora = pelada.status === StatusPelada.ABERTA_INSCRICOES;
    if (vaiComecarAgora) {
      MaquinaStatusPelada.garantirTransicao(
        pelada.status,
        StatusPelada.EM_ANDAMENTO,
      );
    } else if (pelada.status !== StatusPelada.EM_ANDAMENTO) {
      throw new ErroRegraPelada(
        'SORTEIO_STATUS_INVALIDO',
        'Esta pelada ja foi encerrada',
        { status: pelada.status },
      );
    }

    const presentes = await this.participantes.find({
      where: { peladaId, status: StatusParticipantePelada.PRESENTE },
    });

    const resultado = new SorteadorAleatorio().sortear(
      presentes.map((p) => ({
        id: p.id,
        ordemChegada: p.ordemChegada ?? Number.MAX_SAFE_INTEGER,
        ehGoleiroFixo: p.ehGoleiroFixo,
      })),
      pelada.configuracao.jogadoresLinhaPorTime,
    );

    return this.fonteDados.transaction(async (gerenciador) => {
      const partidasExistentes = await gerenciador.find(PartidaEntity, {
        where: { peladaId },
      });
      const emAndamento = partidasExistentes.find(
        (p) => p.status !== StatusPartida.AGUARDANDO,
      );
      if (emAndamento) {
        throw new ErroRegraPelada(
          'SORTEIO_PARTIDA_JA_INICIADA',
          'Nao e possivel sortear: a pelada ja tem partida iniciada',
        );
      }

      if (vaiComecarAgora) {
        await gerenciador.update(PeladaEntity, peladaId, {
          status: StatusPelada.EM_ANDAMENTO,
        });
      }

      await gerenciador.delete(PartidaEntity, { peladaId });
      const timesAnteriores = await gerenciador.find(TimeEntity, {
        where: { peladaId },
      });
      if (timesAnteriores.length) {
        await gerenciador.delete(
          JogadorTimeEntity,
          timesAnteriores.map((t) => t.id),
        );
        await gerenciador.delete(TimeEntity, { peladaId });
      }
      await gerenciador.delete(FilaJogadorEntity, { peladaId });

      const timeCasa = await this.criarTime(
        gerenciador,
        peladaId,
        'Time A',
        '#2457D6',
        1,
        resultado.timeA,
      );
      const timeVisitante = await this.criarTime(
        gerenciador,
        peladaId,
        'Time B',
        '#147D45',
        2,
        resultado.timeB,
      );

      if (resultado.fila.length) {
        await gerenciador.save(
          resultado.fila.map((p, i) =>
            gerenciador.create(FilaJogadorEntity, {
              peladaId,
              participanteId: p.id,
              posicao: i + 1,
              ativo: true,
              saiuEm: null,
            }),
          ),
        );
      }

      const partida = await gerenciador.save(
        gerenciador.create(PartidaEntity, {
          peladaId,
          numero: 1,
          timeCasaId: timeCasa.id,
          timeVisitanteId: timeVisitante.id,
          status: StatusPartida.AGUARDANDO,
        }),
      );

      return { partida, timeCasa, timeVisitante, fila: resultado.fila };
    });
  }

  private async criarTime(
    gerenciador: EntityManager,
    peladaId: string,
    nome: string,
    cor: string,
    ordemCriacao: number,
    lado: { linha: JogadorSorteio[]; goleiro?: JogadorSorteio },
  ): Promise<TimeEntity> {
    const time = await gerenciador.save(
      gerenciador.create(TimeEntity, {
        peladaId,
        nome,
        cor,
        ordemCriacao,
        partidasConsecutivas: 0,
        vitoriasConsecutivas: 0,
        ativo: true,
        dissolvidoEm: null,
      }),
    );

    const elenco = [
      ...lado.linha.map((j) => ({ participanteId: j.id, ehGoleiro: false })),
      ...(lado.goleiro
        ? [{ participanteId: lado.goleiro.id, ehGoleiro: true }]
        : []),
    ];

    await gerenciador.save(
      elenco.map((e) =>
        gerenciador.create(JogadorTimeEntity, {
          timeId: time.id,
          participanteId: e.participanteId,
          ehGoleiro: e.ehGoleiro,
          ativo: true,
          saiuEm: null,
        }),
      ),
    );

    return time;
  }
}
