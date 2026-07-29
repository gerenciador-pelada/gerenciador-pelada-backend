import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

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
  @Column({ type: 'uuid' }) participanteId: string;
  @Column({ default: false }) ehGoleiro: boolean;
  @Column({ default: true }) ativo: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) entrouEm: Date;
  @Column({ type: 'timestamptz', nullable: true }) saiuEm: Date | null;
}
