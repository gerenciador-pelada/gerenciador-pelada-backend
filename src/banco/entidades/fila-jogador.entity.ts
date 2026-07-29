import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
@Entity('fila_jogadores')
@Index(['peladaId', 'participanteId'], {
  unique: true,
  where: '"ativo" = true',
})
@Index(['peladaId', 'posicao'], { unique: true, where: '"ativo" = true' })
export class FilaJogadorEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) peladaId: string;
  @Column({ type: 'uuid' }) participanteId: string;
  @Column({ type: 'int' }) posicao: number;
  @CreateDateColumn({ type: 'timestamptz' }) entrouNaFilaEm: Date;
  @Column({ default: true }) ativo: boolean;
  @Column({ type: 'timestamptz', nullable: true }) saiuEm: Date | null;
}
