import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StatusParticipantePelada } from '../../comum/enums/status-participante-pelada.enum';
import { JogadorEntity } from './jogador.entity';
import { PeladaEntity } from './pelada.entity';

@Entity('participantes_pelada')
@Index('uq_participantes_pelada_jogador', ['peladaId', 'jogadorId'], {
  unique: true,
})
@Index('uq_participantes_pelada_ordem', ['peladaId', 'ordemChegada'], {
  unique: true,
  where: '"ordem_chegada" IS NOT NULL',
})
export class ParticipantePeladaEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) peladaId: string;
  @ManyToOne(() => PeladaEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pelada_id' })
  pelada: PeladaEntity;
  @Column({ type: 'uuid' }) jogadorId: string;
  @ManyToOne(() => JogadorEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'jogador_id' })
  jogador: JogadorEntity;
  @Column({
    type: 'enum',
    enum: StatusParticipantePelada,
    default: StatusParticipantePelada.CONFIRMADO,
  })
  status: StatusParticipantePelada;
  @CreateDateColumn({ type: 'timestamptz' }) confirmadoEm: Date;
  @Column({ type: 'timestamptz', nullable: true }) chegadaEm: Date | null;
  @Column({ type: 'int', nullable: true }) ordemChegada: number | null;
  @Column({ default: false }) ehGoleiroFixo: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) criadoEm: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) atualizadoEm: Date;
}
