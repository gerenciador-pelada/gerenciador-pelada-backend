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
import { PosicaoJogador } from '../../comum/enums/posicao-jogador.enum';
import { UsuarioEntity } from './usuario.entity';

@Entity('jogadores')
@Index('idx_jogadores_usuario_nome', ['usuarioId', 'nome'], {
  unique: true,
  where: '"deletado_em" IS NULL',
})
export class JogadorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => UsuarioEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity;

  @Column({ length: 120 })
  nome: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  apelido: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fotoUrl: string | null;

  @Column({
    type: 'enum',
    enum: PosicaoJogador,
    default: PosicaoJogador.LINHA,
  })
  posicaoPreferida: PosicaoJogador;

  @Column({ default: false })
  podeSerGoleiro: boolean;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletadoEm: Date | null;
}
