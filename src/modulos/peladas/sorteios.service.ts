import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilaJogadorEntity } from '../../banco/entidades/fila-jogador.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { SorteadorAleatorio } from '../../dominio/pelada/sorteador-aleatorio';

@Injectable()
export class SorteiosService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    @InjectRepository(ParticipantePeladaEntity)
    private readonly participantes: Repository<ParticipantePeladaEntity>,
    @InjectRepository(FilaJogadorEntity)
    private readonly fila: Repository<FilaJogadorEntity>,
  ) {}
  async sortear(usuarioId: string, peladaId: string) {
    const pelada = await this.peladas.findOne({
      where: { id: peladaId, organizadorId: usuarioId },
      relations: ['configuracao'],
    });
    if (!pelada) throw new NotFoundException('Pelada nao encontrada');
    if (pelada.status !== StatusPelada.EM_ANDAMENTO)
      throw new ErroRegraPelada(
        'SORTEIO_STATUS_INVALIDO',
        'A pelada precisa estar em andamento',
      );
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
    await this.fila.delete({ peladaId });
    if (resultado.fila.length)
      await this.fila.save(
        resultado.fila.map((p, i) =>
          this.fila.create({
            peladaId,
            participanteId: p.id,
            posicao: i + 1,
            ativo: true,
            saiuEm: null,
          }),
        ),
      );
    return resultado;
  }
}
