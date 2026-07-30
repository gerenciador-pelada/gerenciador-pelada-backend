import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { ACAO_REGISTRO_EVENTO, HistoricoService } from './historico.service';
@Injectable()
export class EventosPartidaService {
  constructor(
    @InjectRepository(PartidaEntity)
    private partidas: Repository<PartidaEntity>,
    @InjectRepository(ParticipacaoPartidaEntity)
    private participacoes: Repository<ParticipacaoPartidaEntity>,
    @InjectRepository(EventoPartidaEntity)
    private eventos: Repository<EventoPartidaEntity>,
    private readonly historico: HistoricoService,
  ) {}
  async registrar(
    usuarioId: string,
    partidaId: string,
    dto: {
      tipo: TipoEventoPartida;
      participanteId: string;
      participanteRelacionadoId?: string;
      timeId: string;
      minuto?: number;
    },
  ) {
    // A posse entra no WHERE: partida inexistente e partida de outro
    // organizador respondem o mesmo 404, sem revelar quais ids existem.
    const partida = await this.partidas
      .createQueryBuilder('partida')
      .innerJoin(PeladaEntity, 'pelada', 'pelada.id = partida.peladaId')
      .where('partida.id = :partidaId', { partidaId })
      .andWhere('pelada.organizadorId = :usuarioId', { usuarioId })
      .getOne();
    if (!partida) throw new NotFoundException('Partida nao encontrada');

    if (partida.status !== StatusPartida.EM_ANDAMENTO) {
      throw new ErroRegraPelada(
        'PARTIDA_NAO_EM_ANDAMENTO',
        'Eventos so podem ser registrados durante a partida',
      );
    }

    if (
      dto.timeId !== partida.timeCasaId &&
      dto.timeId !== partida.timeVisitanteId
    ) {
      throw new ErroRegraPelada(
        'TIME_FORA_PARTIDA',
        'Time nao participa desta partida',
      );
    }

    const p = await this.participacoes.findOne({
      where: { partidaId, participanteId: dto.participanteId },
    });
    if (!p)
      throw new ErroRegraPelada(
        'PARTICIPANTE_FORA_PARTIDA',
        'Participante nao atua nesta partida',
      );

    const ehGol = dto.tipo === TipoEventoPartida.GOL;
    const ehGolContra = dto.tipo === TipoEventoPartida.GOL_CONTRA;

    if (ehGolContra && dto.participanteRelacionadoId) {
      throw new ErroRegraPelada(
        'GOL_CONTRA_SEM_ASSISTENCIA',
        'Gol contra nao aceita assistencia',
      );
    }

    if (ehGolContra && p.timeId === dto.timeId) {
      throw new ErroRegraPelada(
        'AUTOR_GOL_CONTRA_TIME_INVALIDO',
        'O autor do gol contra deve pertencer ao time adversario',
      );
    }

    if (!ehGolContra && p.timeId !== dto.timeId) {
      throw new ErroRegraPelada(
        ehGol ? 'AUTOR_GOL_TIME_INVALIDO' : 'PARTICIPANTE_TIME_INVALIDO',
        ehGol
          ? 'O autor do gol deve pertencer ao time beneficiado'
          : 'O participante nao pertence ao time informado',
      );
    }

    if (dto.participanteRelacionadoId) {
      const relacionado = await this.participacoes.findOne({
        where: { partidaId, participanteId: dto.participanteRelacionadoId },
      });
      if (!relacionado) {
        throw new ErroRegraPelada(
          'PARTICIPANTE_FORA_PARTIDA',
          'Assistente nao atua nesta partida',
        );
      }
      if (!ehGol || relacionado.timeId !== dto.timeId) {
        throw new ErroRegraPelada(
          'ASSISTENTE_TIME_INVALIDO',
          'Assistente deve pertencer ao time beneficiado',
        );
      }
    }

    const e = await this.eventos.save(
      this.eventos.create({
        ...dto,
        // partidaId vem da URL, nao do corpo: sem esta linha a coluna ia nula
        partidaId,
        participanteRelacionadoId: dto.participanteRelacionadoId ?? null,
        registradoPorId: usuarioId,
      }),
    );
    if (ehGol || ehGolContra) {
      if (dto.timeId === partida.timeCasaId) partida.golsCasa++;
      else partida.golsVisitante++;
      await this.partidas.save(partida);
    }

    // Registra no historico para que o desfazer da tela consiga reverter.
    // Sem isto o botao existia e nao fazia nada.
    await this.historico.registrar(
      partida.peladaId,
      usuarioId,
      ACAO_REGISTRO_EVENTO,
      {
        eventoId: e.id,
        partidaId: partida.id,
        tipo: dto.tipo,
        timeId: dto.timeId,
        descricao: dto.tipo.toLowerCase().replace(/_/g, ' '),
      },
    );

    return e;
  }
}
