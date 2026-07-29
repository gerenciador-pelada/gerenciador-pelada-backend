import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarJogadores1785336482135 implements MigrationInterface {
  name = 'CriarJogadores1785336482135';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."jogadores_posicao_preferida_enum" AS ENUM('GOLEIRO', 'ZAGUEIRO', 'MEIA', 'ATACANTE', 'LINHA')`,
    );
    await queryRunner.query(
      `CREATE TABLE "jogadores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "nome" character varying(120) NOT NULL, "apelido" character varying(60), "foto_url" character varying(500), "posicao_preferida" "public"."jogadores_posicao_preferida_enum" NOT NULL DEFAULT 'LINHA', "pode_ser_goleiro" boolean NOT NULL DEFAULT false, "ativo" boolean NOT NULL DEFAULT true, "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletado_em" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_47e3895364f0c1590ec6f47e75f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_jogadores_usuario_nome" ON "jogadores" ("usuario_id", "nome") WHERE "deletado_em" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "jogadores" ADD CONSTRAINT "FK_37cc14073a17945225e29476d75" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jogadores" DROP CONSTRAINT "FK_37cc14073a17945225e29476d75"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_jogadores_usuario_nome"`);
    await queryRunner.query(`DROP TABLE "jogadores"`);
    await queryRunner.query(
      `DROP TYPE "public"."jogadores_posicao_preferida_enum"`,
    );
  }
}
