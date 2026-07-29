import {
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

@Entity('locais_pelada')
@Index('idx_locais_usuario_nome', ['usuarioId', 'nome'], {
  unique: true,
  where: '"deletado_em" IS NULL',
})
export class LocalPeladaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => UsuarioEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity;

  @Column({ length: 120 })
  nome: string;

  @Column({ type: 'varchar', length: 250, nullable: true })
  endereco: string | null;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletadoEm: Date | null;
}
