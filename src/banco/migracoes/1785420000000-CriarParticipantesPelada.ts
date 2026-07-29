import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarParticipantesPelada1785420000000 implements MigrationInterface {
  name = 'CriarParticipantesPelada1785420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."participantes_pelada_status_enum" AS ENUM('CONFIRMADO', 'PRESENTE', 'AUSENTE', 'DESISTIU', 'JOGANDO', 'AGUARDANDO', 'DESCANSANDO')`,
    );
    await queryRunner.query(
      `CREATE TABLE "participantes_pelada" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pelada_id" uuid NOT NULL, "jogador_id" uuid NOT NULL, "status" "public"."participantes_pelada_status_enum" NOT NULL DEFAULT 'CONFIRMADO', "confirmado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "chegada_em" TIMESTAMP WITH TIME ZONE, "ordem_chegada" integer, "eh_goleiro_fixo" boolean NOT NULL DEFAULT false, "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_participantes_pelada" PRIMARY KEY ("id"), CONSTRAINT "uq_participantes_pelada_jogador" UNIQUE ("pelada_id", "jogador_id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_participantes_pelada_ordem" ON "participantes_pelada" ("pelada_id", "ordem_chegada") WHERE "ordem_chegada" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" ADD CONSTRAINT "FK_participantes_pelada_pelada" FOREIGN KEY ("pelada_id") REFERENCES "peladas"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" ADD CONSTRAINT "FK_participantes_pelada_jogador" FOREIGN KEY ("jogador_id") REFERENCES "jogadores"("id") ON DELETE RESTRICT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" DROP CONSTRAINT "FK_participantes_pelada_jogador"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" DROP CONSTRAINT "FK_participantes_pelada_pelada"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_participantes_pelada_ordem"`,
    );
    await queryRunner.query(`DROP TABLE "participantes_pelada"`);
    await queryRunner.query(
      `DROP TYPE "public"."participantes_pelada_status_enum"`,
    );
  }
}
