import { MigrationInterface, QueryRunner } from 'typeorm';
export class CriarHistoricoAcoes1785424000000 implements MigrationInterface {
  name = 'CriarHistoricoAcoes1785424000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "historico_acoes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(),"pelada_id" uuid NOT NULL,"usuario_id" uuid NOT NULL,"acao" character varying(60) NOT NULL,"dados_anteriores" jsonb,"dados_posteriores" jsonb,"snapshot_estado" jsonb NOT NULL,"desfeita_em" TIMESTAMP WITH TIME ZONE,"criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),CONSTRAINT "PK_historico_acoes" PRIMARY KEY("id"))`,
    );
    await q.query(
      `CREATE INDEX "idx_historico_pelada_criado" ON "historico_acoes" ("pelada_id","criado_em")`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "historico_acoes"`);
  }
}
