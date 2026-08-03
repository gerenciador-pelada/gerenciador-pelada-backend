import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StatusAssinatura } from '../../comum/enums/status-assinatura.enum';
import { UsuarioEntity } from './usuario.entity';

/**
 * Assinatura do app por organizador.
 *
 * Espelho local do que vive no Asaas. Guardar em vez de consultar a cada
 * requisicao: a tela pergunta "posso usar?" o tempo todo, e depender de uma
 * chamada externa para responder deixaria o app fora do ar sempre que o Asaas
 * ficasse lento.
 *
 * A verdade continua sendo o Asaas — o webhook e quem atualiza este espelho.
 */
@Entity('assinaturas')
@Index('idx_assinaturas_asaas', ['asaasAssinaturaId'], { unique: true })
export class AssinaturaEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  // Uma por organizador: duas assinaturas ativas para a mesma pessoa seria
  // cobranca dobrada, e o banco recusa antes que isso chegue a acontecer.
  @Column({ type: 'uuid', unique: true }) usuarioId: string;
  @OneToOne(() => UsuarioEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity;

  @Column({ type: 'varchar', length: 60 }) asaasClienteId: string;
  @Column({ type: 'varchar', length: 60 }) asaasAssinaturaId: string;

  @Column({ type: 'enum', enum: StatusAssinatura })
  status: StatusAssinatura;

  /** Centavos, como todo dinheiro do projeto. */
  @Column({ type: 'integer' }) valorCentavos: number;

  @Column({ type: 'varchar', length: 20 }) ciclo: string;

  /**
   * Ate quando o acesso esta pago.
   *
   * E o campo que o portao vai ler. Fica separado do status porque uma
   * assinatura cancelada hoje continua valendo ate o fim do ciclo ja pago —
   * cortar na hora seria cobrar por um mes e entregar meio.
   */
  @Column({ type: 'timestamptz', nullable: true })
  acessoAte: Date | null;

  @CreateDateColumn({ type: 'timestamptz' }) criadoEm: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) atualizadoEm: Date;
}
