import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoEventoPartida } from '../../comum/enums/tipo-evento-partida.enum';
@Entity('eventos_partida')
export class EventoPartidaEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) partidaId: string;
  @Column({ type: 'enum', enum: TipoEventoPartida }) tipo: TipoEventoPartida;
  @Column({ type: 'uuid' }) participanteId: string;
  @Column({ type: 'uuid', nullable: true }) participanteRelacionadoId:
    string | null;
  @Column({ type: 'uuid' }) timeId: string;
  @Column({ type: 'int', nullable: true }) minuto: number | null;
  @Column({ type: 'uuid' }) registradoPorId: string;
  @CreateDateColumn({ type: 'timestamptz' }) criadoEm: Date;
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletadoEm: Date | null;
}
