import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarTemporadas1785337017320 implements MigrationInterface {
  name = 'CriarTemporadas1785337017320';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporadas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "nome" character varying(120) NOT NULL, "data_inicio" date NOT NULL, "data_fim" date NOT NULL, "ativa" boolean NOT NULL DEFAULT true, "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletado_em" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_temporadas_periodo" CHECK ("data_fim" >= "data_inicio"), CONSTRAINT "PK_a8b4bf9d1552c61b34d5ba94a71" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_temporadas_usuario_nome" ON "temporadas" ("usuario_id", "nome") WHERE "deletado_em" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "temporadas" ADD CONSTRAINT "FK_18d8104762a2dfff9e9f5647e3f" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "temporadas" DROP CONSTRAINT "FK_18d8104762a2dfff9e9f5647e3f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_temporadas_usuario_nome"`,
    );
    await queryRunner.query(`DROP TABLE "temporadas"`);
  }
}
