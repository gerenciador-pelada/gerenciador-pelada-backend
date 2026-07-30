import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarGruposPelada1785426000000 implements MigrationInterface {
  name = 'CriarGruposPelada1785426000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "grupos_pelada" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizador_id" uuid NOT NULL,
        "nome" character varying(120) NOT NULL,
        "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletado_em" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_grupos_pelada" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grupos_pelada_organizador"
          FOREIGN KEY ("organizador_id") REFERENCES "usuarios"("id")
          ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_grupos_pelada_organizador_nome"
        ON "grupos_pelada" ("organizador_id", lower(btrim("nome")))
        WHERE "deletado_em" IS NULL`,
    );

    await queryRunner.query(
      `INSERT INTO "grupos_pelada"
        ("id", "organizador_id", "nome", "criado_em", "atualizado_em", "deletado_em")
      SELECT
        min("id"::text)::uuid,
        "organizador_id",
        min(btrim("nome")),
        min("criado_em"),
        max("atualizado_em"),
        CASE
          WHEN bool_and("deletado_em" IS NOT NULL) THEN max("deletado_em")
          ELSE NULL
        END
      FROM "peladas"
      GROUP BY "organizador_id", lower(btrim("nome"))`,
    );

    await queryRunner.query(`ALTER TABLE "peladas" ADD "grupo_id" uuid`);
    await queryRunner.query(
      `UPDATE "peladas" AS p
      SET "grupo_id" = g."id", "nome" = g."nome"
      FROM "grupos_pelada" AS g
      WHERE g."organizador_id" = p."organizador_id"
        AND lower(btrim(g."nome")) = lower(btrim(p."nome"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" ALTER COLUMN "grupo_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_peladas_grupo_data"
        ON "peladas" ("grupo_id", "data_hora")`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas"
        ADD CONSTRAINT "FK_peladas_grupo"
        FOREIGN KEY ("grupo_id") REFERENCES "grupos_pelada"("id")
        ON DELETE RESTRICT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "peladas" DROP CONSTRAINT "FK_peladas_grupo"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_peladas_grupo_data"`);
    await queryRunner.query(`ALTER TABLE "peladas" DROP COLUMN "grupo_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_grupos_pelada_organizador_nome"`,
    );
    await queryRunner.query(`DROP TABLE "grupos_pelada"`);
  }
}
