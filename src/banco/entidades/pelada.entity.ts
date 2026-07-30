import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StatusPelada } from '../../comum/enums/status-pelada.enum';
import { ConfiguracaoPeladaEntity } from './configuracao-pelada.entity';
import { GrupoPeladaEntity } from './grupo-pelada.entity';
import { LocalPeladaEntity } from './local-pelada.entity';
import { TemporadaEntity } from './temporada.entity';
import { UsuarioEntity } from './usuario.entity';

@Entity('peladas')
@Index('idx_peladas_organizador_data', ['organizadorId', 'dataHora'])
@Index('idx_peladas_grupo_data', ['grupoId', 'dataHora'])
@Index('idx_peladas_status', ['status'])
export class PeladaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizadorId: string;

  @ManyToOne(() => UsuarioEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizador_id' })
  organizador: UsuarioEntity;

  @Column({ type: 'uuid' })
  grupoId: string;

  @ManyToOne(() => GrupoPeladaEntity, (grupo) => grupo.edicoes, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'grupo_id' })
  grupo: GrupoPeladaEntity;

  @Column({ type: 'uuid' })
  localId: string;

  @ManyToOne(() => LocalPeladaEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'local_id' })
  local: LocalPeladaEntity;

  @Column({ type: 'uuid', nullable: true })
  temporadaId: string | null;

  @ManyToOne(() => TemporadaEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'temporada_id' })
  temporada: TemporadaEntity | null;

  @Column({ length: 120 })
  nome: string;

  @Column({ type: 'timestamptz' })
  dataHora: Date;

  @Column({
    type: 'enum',
    enum: StatusPelada,
    default: StatusPelada.ABERTA_INSCRICOES,
  })
  status: StatusPelada;

  @OneToOne(
    () => ConfiguracaoPeladaEntity,
    (configuracao) => configuracao.pelada,
    {
      cascade: ['insert'],
    },
  )
  configuracao: ConfiguracaoPeladaEntity;

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletadoEm: Date | null;
}
