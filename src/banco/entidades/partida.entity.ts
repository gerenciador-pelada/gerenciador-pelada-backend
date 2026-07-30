import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StatusPartida } from '../../comum/enums/status-partida.enum';
import { ParticipantePeladaEntity } from './participante-pelada.entity';

@Entity('partidas')
@Check(
  'chk_partida_goleiros_avulsos_distintos',
  '"goleiro_casa_id" IS NULL OR "goleiro_visitante_id" IS NULL OR "goleiro_casa_id" <> "goleiro_visitante_id"',
)
export class PartidaEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) peladaId: string;
  @Column({ type: 'int' }) numero: number;
  @Column({ type: 'uuid' }) timeCasaId: string;
  @Column({ type: 'uuid' }) timeVisitanteId: string;

  @Column({ type: 'uuid', nullable: true })
  goleiroCasaId: string | null;

  @ManyToOne(() => ParticipantePeladaEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'goleiro_casa_id' })
  goleiroCasa: ParticipantePeladaEntity | null;

  @Column({ type: 'uuid', nullable: true })
  goleiroVisitanteId: string | null;

  @ManyToOne(() => ParticipantePeladaEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'goleiro_visitante_id' })
  goleiroVisitante: ParticipantePeladaEntity | null;

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
  @Column({ type: 'varchar', length: 10, nullable: true })
  vencedorDecisao: 'CASA' | 'VISITANTE' | null;
  @CreateDateColumn({ type: 'timestamptz' }) criadoEm: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) atualizadoEm: Date;
}
