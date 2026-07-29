import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
@Entity('pontuacoes_jogador')
@Index(['partidaId', 'participanteId'], { unique: true })
export class PontuacaoJogadorEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) peladaId: string;
  @Column({ type: 'uuid' }) partidaId: string;
  @Column({ type: 'uuid' }) participanteId: string;
  @Column({ type: 'uuid' }) jogadorId: string;
  @Column({ type: 'int', default: 0 }) pontosVitoria: number;
  @Column({ type: 'int', default: 0 }) pontosGols: number;
  @Column({ type: 'int', default: 0 }) pontosAssistencias: number;
  @Column({ type: 'int', default: 0 }) pontosBolaCheia: number;
  @Column({ type: 'int', default: 0 }) pontosBolaMurcha: number;
  @Column({ type: 'int', default: 0 }) pontosTotal: number;
  @CreateDateColumn({ type: 'timestamptz' }) calculadoEm: Date;
}
