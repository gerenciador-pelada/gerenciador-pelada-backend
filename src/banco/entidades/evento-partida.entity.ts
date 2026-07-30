import {
  JoinColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
import { ParticipantePeladaEntity } from './participante-pelada.entity';
import { PartidaEntity } from './partida.entity';
@Entity('eventos_partida')
export class EventoPartidaEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) partidaId: string;
  @ManyToOne(() => PartidaEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partida_id' })
  partida: PartidaEntity;
  @Column({ type: 'enum', enum: TipoEventoPartida }) tipo: TipoEventoPartida;
  // RESTRICT: o autor de um gol nao pode sumir do banco e deixar o evento orfao.
  @Column({ type: 'uuid' }) participanteId: string;
  @ManyToOne(() => ParticipantePeladaEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'participante_id' })
  participante: ParticipantePeladaEntity;
  @Column({ type: 'uuid', nullable: true }) participanteRelacionadoId:
    string | null;
  @Column({ type: 'uuid' }) timeId: string;
  @Column({ type: 'int', nullable: true }) minuto: number | null;
  @Column({ type: 'uuid' }) registradoPorId: string;
  @CreateDateColumn({ type: 'timestamptz' }) criadoEm: Date;
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletadoEm: Date | null;
}
