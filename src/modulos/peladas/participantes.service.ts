import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JogadorEntity } from '../../banco/entidades/jogador.entity';
import { ParticipantePeladaEntity } from '../../banco/entidades/participante-pelada.entity';
import { PeladaEntity } from '../../banco/entidades/pelada.entity';
import { MaquinaStatusPelada } from '../../dominio/pelada/maquina-status-pelada';
import { ErroRegraPelada } from '../../dominio/erros/erro-regra-pelada';
import { AdicionarParticipanteDto } from './dto/adicionar-participante.dto';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';

@Injectable()
export class ParticipantesService {
  constructor(
    @InjectRepository(PeladaEntity)
    private readonly peladas: Repository<PeladaEntity>,
    @InjectRepository(JogadorEntity)
    private readonly jogadores: Repository<JogadorEntity>,
    @InjectRepository(ParticipantePeladaEntity)
    private readonly participantes: Repository<ParticipantePeladaEntity>,
  ) {}
  async adicionar(
    usuarioId: string,
    peladaId: string,
    dto: AdicionarParticipanteDto,
  ): Promise<ParticipantePeladaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    if (
      !(await this.jogadores.findOne({
        where: { id: dto.jogadorId, usuarioId },
      }))
    )
      throw new NotFoundException('Jogador nao encontrado');
    if (
      await this.participantes.findOne({
        where: { peladaId, jogadorId: dto.jogadorId },
      })
    )
      throw new ErroRegraPelada(
        'PARTICIPANTE_DUPLICADO',
        'Jogador ja participa da pelada',
      );
    if (
      (await this.participantes.count({ where: { peladaId } })) >=
      pelada.configuracao.maximoJogadores
    )
      throw new ErroRegraPelada(
        'MAXIMO_JOGADORES_ATINGIDO',
        'Limite de participantes atingido',
      );
    return this.participantes.save(
      this.participantes.create({
        peladaId,
        jogadorId: dto.jogadorId,
        ehGoleiroFixo: dto.ehGoleiroFixo ?? false,
        status: StatusParticipantePelada.CONFIRMADO,
      }),
    );
  }
  async listar(
    usuarioId: string,
    peladaId: string,
  ): Promise<ParticipantePeladaEntity[]> {
    await this.carregarPelada(usuarioId, peladaId);
    return this.participantes.find({
      where: { peladaId },
      relations: ['jogador'],
      order: { ordemChegada: 'ASC', confirmadoEm: 'ASC' },
    });
  }
  async marcarChegada(
    usuarioId: string,
    peladaId: string,
    id: string,
  ): Promise<ParticipantePeladaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    const p = await this.participantes.findOne({ where: { id, peladaId } });
    if (!p) throw new NotFoundException('Participante nao encontrado');
    if (p.ordemChegada === null) {
      const ultimo = await this.participantes
        .createQueryBuilder('p')
        .select('COALESCE(MAX(p.ordemChegada), 0)', 'maximo')
        .where('p.peladaId = :peladaId', { peladaId })
        .getRawOne<{ maximo: string }>();
      p.ordemChegada = Number(ultimo?.maximo ?? 0) + 1;
      p.chegadaEm = new Date();
    }
    p.status = StatusParticipantePelada.PRESENTE;
    return this.participantes.save(p);
  }
  async alterarStatus(
    usuarioId: string,
    peladaId: string,
    id: string,
    status: StatusParticipantePelada,
  ): Promise<ParticipantePeladaEntity> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    const participante = await this.participantes.findOne({
      where: { id, peladaId },
    });
    if (!participante)
      throw new NotFoundException('Participante nao encontrado');
    participante.status = status;
    return this.participantes.save(participante);
  }
  async remover(
    usuarioId: string,
    peladaId: string,
    id: string,
  ): Promise<void> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    const participante = await this.participantes.findOne({
      where: { id, peladaId },
    });
    if (!participante)
      throw new NotFoundException('Participante nao encontrado');
    await this.participantes.remove(participante);
  }
  async reordenar(
    usuarioId: string,
    peladaId: string,
    ids: string[],
  ): Promise<ParticipantePeladaEntity[]> {
    const pelada = await this.carregarPelada(usuarioId, peladaId);
    this.garantirAberta(pelada);
    const presentes = await this.participantes.find({
      where: { peladaId, status: StatusParticipantePelada.PRESENTE },
    });
    if (
      ids.length !== presentes.length ||
      new Set(ids).size !== ids.length ||
      presentes.some((p) => !ids.includes(p.id))
    )
      throw new ErroRegraPelada(
        'ORDEM_CHEGADA_INVALIDA',
        'A ordem deve conter todos os presentes uma unica vez',
      );
    const porId = new Map(presentes.map((p) => [p.id, p]));
    ids.forEach((id, index) => {
      const p = porId.get(id);
      if (p) p.ordemChegada = index + 1;
    });
    return this.participantes.save(presentes);
  }
  private async carregarPelada(
    usuarioId: string,
    id: string,
  ): Promise<PeladaEntity> {
    const p = await this.peladas.findOne({
      where: { id, organizadorId: usuarioId },
      relations: ['configuracao'],
    });
    if (!p) throw new NotFoundException('Pelada nao encontrada');
    return p;
  }
  private garantirAberta(p: PeladaEntity): void {
    if (MaquinaStatusPelada.estaEncerrada(p.status))
      throw new ErroRegraPelada('PELADA_ENCERRADA', 'Pelada encerrada');
  }
}
