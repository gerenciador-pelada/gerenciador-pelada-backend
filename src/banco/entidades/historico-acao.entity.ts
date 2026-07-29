import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
@Entity('historico_acoes')
@Index(['peladaId', 'criadoEm'])
export class HistoricoAcaoEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) peladaId: string;
  @Column({ type: 'uuid' }) usuarioId: string;
  @Column({ length: 60 }) acao: string;
  @Column({ type: 'jsonb', nullable: true }) dadosAnteriores: Record<
    string,
    unknown
  > | null;
  @Column({ type: 'jsonb', nullable: true }) dadosPosteriores: Record<
    string,
    unknown
  > | null;
  @Column({ type: 'jsonb' }) snapshotEstado: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) desfeitaEm: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) criadoEm: Date;
}
