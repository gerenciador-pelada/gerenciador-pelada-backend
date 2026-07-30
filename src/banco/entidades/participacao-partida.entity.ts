import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ParticipantePeladaEntity } from './participante-pelada.entity';
import { PartidaEntity } from './partida.entity';
import { TimeEntity } from './time.entity';
@Entity('participacoes_partida')
@Index(['partidaId', 'participanteId'], { unique: true })
export class ParticipacaoPartidaEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) partidaId: string;
  @ManyToOne(() => PartidaEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partida_id' })
  partida: PartidaEntity;

  // RESTRICT: apagar um participante que ja jogou destruiria o historico da
  // partida. Quem sai da pelada usa desistencia, que preserva o registro.
  @Column({ type: 'uuid' }) participanteId: string;
  @ManyToOne(() => ParticipantePeladaEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'participante_id' })
  participante: ParticipantePeladaEntity;

  @Column({ type: 'uuid' }) timeId: string;
  @ManyToOne(() => TimeEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'time_id' })
  time: TimeEntity;
  @Column({ default: false }) ehGoleiro: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) entrouEm: Date;
  @Column({ type: 'timestamptz', nullable: true }) saiuEm: Date | null;
  @Column({ type: 'int', nullable: true }) minutosJogados: number | null;
}
