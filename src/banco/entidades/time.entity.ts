import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Um time e criado quando um conjunto de jogadores passa a jogar junto, e e
 * dissolvido (ativo = false) quando perde e seus jogadores voltam para a fila.
 *
 * O time vencedor mantem a mesma linha entre partidas: e isso que preserva a
 * formacao e permite contar vitorias consecutivas, que a regra de empate
 * MAIS_TEMPO_EM_CAMPO_SAI consulta.
 */
@Entity('times')
@Index(['peladaId', 'ativo'])
export class TimeEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) peladaId: string;
  @Column({ length: 40 }) nome: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) cor: string | null;
  @Column({ type: 'int' }) ordemCriacao: number;
  @Column({ type: 'int', default: 0 }) partidasConsecutivas: number;
  @Column({ type: 'int', default: 0 }) vitoriasConsecutivas: number;
  @Column({ default: true }) ativo: boolean;
  @Column({ type: 'timestamptz', nullable: true }) dissolvidoEm: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) criadoEm: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) atualizadoEm: Date;
}
