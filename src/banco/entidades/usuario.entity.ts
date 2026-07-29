import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PerfilUsuario } from '../../comum/enums/perfil-usuario.enum';

@Entity('usuarios')
export class UsuarioEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  nome: string;

  @Index('idx_usuarios_email', { unique: true })
  @Column({ length: 160 })
  email: string;

  @Column({ length: 120, select: false })
  senhaHash: string;

  @Column({
    type: 'enum',
    enum: PerfilUsuario,
    default: PerfilUsuario.ORGANIZADOR,
  })
  perfil: PerfilUsuario;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletadoEm: Date | null;
}
