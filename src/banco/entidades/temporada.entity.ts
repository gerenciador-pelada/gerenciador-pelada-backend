import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UsuarioEntity } from './usuario.entity';

@Entity('temporadas')
@Index('idx_temporadas_usuario_nome', ['usuarioId', 'nome'], {
  unique: true,
  where: '"deletado_em" IS NULL',
})
@Check('chk_temporadas_periodo', '"data_fim" >= "data_inicio"')
export class TemporadaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => UsuarioEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity;

  @Column({ length: 120 })
  nome: string;

  @Column({ type: 'date' })
  dataInicio: string;

  @Column({ type: 'date' })
  dataFim: string;

  @Column({ default: true })
  ativa: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletadoEm: Date | null;
}
