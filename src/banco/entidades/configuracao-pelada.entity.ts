import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CriterioDesempate } from '../../comum/enums/criterio-desempate.enum';
import { FormaEscolhaTimes } from '../../comum/enums/forma-escolha-times.enum';
import { ModalidadeGoleiro } from '../../comum/enums/modalidade-goleiro.enum';
import { RegraEmpate } from '../../comum/enums/regra-empate.enum';
import { PeladaEntity } from './pelada.entity';

@Entity('configuracoes_pelada')
@Check(
  'chk_configuracao_jogadores_linha',
  '"jogadores_linha_por_time" BETWEEN 1 AND 11',
)
@Check('chk_configuracao_goleiros', '"quantidade_goleiros" BETWEEN 0 AND 4')
@Check('chk_configuracao_maximo_jogadores', '"maximo_jogadores" >= 2')
@Check(
  'chk_configuracao_duracao',
  '"duracao_partida_minutos" BETWEEN 1 AND 120',
)
export class ConfiguracaoPeladaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  peladaId: string;

  @OneToOne(() => PeladaEntity, (pelada) => pelada.configuracao, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pelada_id' })
  pelada: PeladaEntity;

  // --- estrutura do time (congela quando a pelada comeca) ---

  @Column({ type: 'int', default: 5 })
  jogadoresLinhaPorTime: number;

  @Column({ type: 'int', default: 2 })
  quantidadeGoleiros: number;

  @Column({
    type: 'enum',
    enum: ModalidadeGoleiro,
    default: ModalidadeGoleiro.FIXO,
  })
  modalidadeGoleiro: ModalidadeGoleiro;

  @Column({ default: true })
  goleirosAlternamTimes: boolean;

  @Column({
    type: 'enum',
    enum: FormaEscolhaTimes,
    default: FormaEscolhaTimes.SORTEIO_ALEATORIO,
  })
  formaEscolhaTimesIniciais: FormaEscolhaTimes;

  // --- partida ---

  @Column({ type: 'int', default: 20 })
  maximoJogadores: number;

  @Column({ type: 'int', default: 10 })
  duracaoPartidaMinutos: number;

  @Column({ type: 'int', nullable: true, default: null })
  maximoGols: number | null;

  @Column({ default: true })
  permiteEmpate: boolean;

  @Column({ type: 'enum', enum: RegraEmpate, default: RegraEmpate.AMBOS_SAEM })
  regraEmpate: RegraEmpate;

  // --- pontuacao ---

  @Column({ type: 'int', default: 3 })
  pontosVitoria: number;

  @Column({ type: 'int', default: 1 })
  pontosEmpate: number;

  @Column({ type: 'int', default: 0 })
  pontosDerrota: number;

  @Column({ type: 'int', default: 0 })
  pontosGol: number;

  @Column({ type: 'int', default: 0 })
  pontosAssistencia: number;

  @Column({ type: 'int', default: 0 })
  pontosBolaCheia: number;

  @Column({ type: 'int', default: 0 })
  pontosBolaMurcha: number;

  @Column({ type: 'int', default: 0 })
  pontosPartidaGoleiro: number;

  @Column({ type: 'int', default: 0 })
  pontosJogoSemSofrerGol: number;

  // --- ranking ---

  @Column({
    type: 'jsonb',
    default: () =>
      `'["${CriterioDesempate.VITORIAS}","${CriterioDesempate.SALDO_GOLS}","${CriterioDesempate.GOLS}"]'::jsonb`,
  })
  criteriosDesempateRanking: CriterioDesempate[];

  @CreateDateColumn({ type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  atualizadoEm: Date;
}
