import { MigrationInterface, QueryRunner } from 'typeorm';
export class CriarFilaJogadores1785421000000 implements MigrationInterface {
  name = 'CriarFilaJogadores1785421000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "fila_jogadores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pelada_id" uuid NOT NULL, "participante_id" uuid NOT NULL, "posicao" integer NOT NULL, "entrou_na_fila_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ativo" boolean NOT NULL DEFAULT true, "saiu_em" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_fila_jogadores" PRIMARY KEY ("id"))`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "uq_fila_participante_ativo" ON "fila_jogadores" ("pelada_id", "participante_id") WHERE "ativo" = true`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "uq_fila_posicao_ativa" ON "fila_jogadores" ("pelada_id", "posicao") WHERE "ativo" = true`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "fila_jogadores"`);
  }
}
