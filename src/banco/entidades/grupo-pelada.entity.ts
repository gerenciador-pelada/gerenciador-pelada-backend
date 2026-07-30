import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PeladaEntity } from './pelada.entity';
import { UsuarioEntity } from './usuario.entity';

@Entity('grupos_pelada')
export class GrupoPeladaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizadorId: string;

  @ManyToOne(() => UsuarioEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizador_id' })
  organizador: UsuarioEntity;

  @Column({ length: 120 })
  nome: string;

  @OneToMany(() => PeladaEntity, 'grupo')
  edicoes: PeladaEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletadoEm: Date | null;
}
