import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
@Entity('partidas')
export class PartidaEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) peladaId: string;
  @Column({ type: 'int' }) numero: number;
  @Column({ type: 'uuid' }) timeCasaId: string;
  @Column({ type: 'uuid' }) timeVisitanteId: string;
  @Column({ type: 'int', default: 0 }) golsCasa: number;
  @Column({ type: 'int', default: 0 }) golsVisitante: number;
  @Column({
    type: 'enum',
    enum: StatusPartida,
    default: StatusPartida.AGUARDANDO,
  })
  status: StatusPartida;
  @Column({ type: 'timestamptz', nullable: true }) iniciadaEm: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) finalizadaEm: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) criadoEm: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) atualizadoEm: Date;
}
