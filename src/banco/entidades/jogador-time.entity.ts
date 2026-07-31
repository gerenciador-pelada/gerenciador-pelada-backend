import {
  JoinColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ParticipantePeladaEntity } from './participante-pelada.entity';
import { TimeEntity } from './time.entity';

/**
 * Elenco de um time. O indice unico parcial impede o mesmo participante de
 * figurar duas vezes no elenco ativo do mesmo time; jogadores que sairam
 * (ativo = false) permanecem como historico.
 */
@Entity('jogadores_time')
@Index('idx_jogadores_time_ativo', ['timeId', 'participanteId'], {
  unique: true,
  where: '"ativo" = true',
})
export class JogadorTimeEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) timeId: string;
  @ManyToOne(() => TimeEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'time_id' })
  time: TimeEntity;

  @Column({ type: 'uuid' }) participanteId: string;
  @ManyToOne(() => ParticipantePeladaEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participante_id' })
  participante: ParticipantePeladaEntity;

  @Column({ type: 'uuid', nullable: true })
  substituiParticipanteId: string | null;
  @ManyToOne(() => ParticipantePeladaEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'substitui_participante_id' })
  substituiParticipante: ParticipantePeladaEntity | null;

  @Column({ default: false }) ehGoleiro: boolean;
  @Column({ default: true }) ativo: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) entrouEm: Date;
  @Column({ type: 'timestamptz', nullable: true }) saiuEm: Date | null;
}
