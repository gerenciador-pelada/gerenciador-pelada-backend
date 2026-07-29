import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventoPartidaEntity } from '../../banco/entidades/evento-partida.entity';
import { ParticipacaoPartidaEntity } from '../../banco/entidades/participacao-partida.entity';
import { PartidaEntity } from '../../banco/entidades/partida.entity';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
@Injectable()
export class EventosPartidaService {
  constructor(
    @InjectRepository(PartidaEntity)
    private partidas: Repository<PartidaEntity>,
    @InjectRepository(ParticipacaoPartidaEntity)
    private participacoes: Repository<ParticipacaoPartidaEntity>,
    @InjectRepository(EventoPartidaEntity)
    private eventos: Repository<EventoPartidaEntity>,
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
    const partida = await this.partidas.findOne({ where: { id: partidaId } });
    if (!partida) throw new NotFoundException('Partida nao encontrada');
    const p = await this.participacoes.findOne({
      where: { partidaId, participanteId: dto.participanteId },
    });
    if (!p)
      throw new ErroRegraPelada(
        'PARTICIPANTE_FORA_PARTIDA',
        'Participante nao atua nesta partida',
      );
    if (
      dto.participanteRelacionadoId &&
      !(await this.participacoes.findOne({
        where: { partidaId, participanteId: dto.participanteRelacionadoId },
      }))
    )
      throw new ErroRegraPelada(
        'PARTICIPANTE_FORA_PARTIDA',
        'Assistente nao atua nesta partida',
      );
    const e = await this.eventos.save(
      this.eventos.create({
        ...dto,
        participanteRelacionadoId: dto.participanteRelacionadoId ?? null,
        registradoPorId: usuarioId,
      }),
    );
    if (dto.tipo === TipoEventoPartida.GOL) {
      if (dto.timeId === partida.timeCasaId) partida.golsCasa++;
      else partida.golsVisitante++;
      await this.partidas.save(partida);
    }
    return e;
  }
}
