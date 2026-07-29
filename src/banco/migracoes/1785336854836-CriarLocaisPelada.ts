import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarLocaisPelada1785336854836 implements MigrationInterface {
  name = 'CriarLocaisPelada1785336854836';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "locais_pelada" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "nome" character varying(120) NOT NULL, "endereco" character varying(250), "ativo" boolean NOT NULL DEFAULT true, "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletado_em" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e8ed4c57c9ed1cccda7fd3cfada" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_locais_usuario_nome" ON "locais_pelada" ("usuario_id", "nome") WHERE "deletado_em" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "locais_pelada" ADD CONSTRAINT "FK_3ef813431f27e39a4aec3cc1353" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "locais_pelada" DROP CONSTRAINT "FK_3ef813431f27e39a4aec3cc1353"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_locais_usuario_nome"`);
    await queryRunner.query(`DROP TABLE "locais_pelada"`);
  }
}
