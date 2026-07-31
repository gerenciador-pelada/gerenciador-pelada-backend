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

  /**
   * Quanto custou o campo, em CENTAVOS.
   *
   * Inteiro e nao decimal: dinheiro em ponto flutuante acumula erro, e aqui a
   * soma do rateio precisa fechar com o total. Nulo = ainda nao informado.
   */
  @Column({ type: 'int', nullable: true }) valorCampoCentavos: number | null;

  /** Em muita pelada o goleiro fixo joga de graca por ficar no gol. */
  @Column({ default: true }) goleiroFixoPaga: boolean;

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

  /**
   * Token do link publico do ranking. Nulo = sem link ativo.
   *
   * Nullable de proposito: revogar e apagar o valor, e o link antigo passa a
   * nao existir. Um token na URL vai parar no historico do navegador e na
   * previa de link do WhatsApp, entao vale como segredo fraco — por isso
   * precisa ser descartavel, e por isso da acesso apenas a classificacao.
   */
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  tokenPublico: string | null;
}
