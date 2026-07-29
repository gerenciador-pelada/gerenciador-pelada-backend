import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
@Entity('participacoes_partida')
@Index(['partidaId', 'participanteId'], { unique: true })
export class ParticipacaoPartidaEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) partidaId: string;
  @Column({ type: 'uuid' }) participanteId: string;
  @Column({ type: 'uuid' }) timeId: string;
  @Column({ default: false }) ehGoleiro: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) entrouEm: Date;
  @Column({ type: 'timestamptz', nullable: true }) saiuEm: Date | null;
  @Column({ type: 'int', nullable: true }) minutosJogados: number | null;
}
