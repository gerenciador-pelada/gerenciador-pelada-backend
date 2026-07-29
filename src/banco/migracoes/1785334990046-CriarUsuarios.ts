import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarUsuarios1785334990046 implements MigrationInterface {
  name = 'CriarUsuarios1785334990046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."usuarios_perfil_enum" AS ENUM('ADMINISTRADOR', 'ORGANIZADOR')`,
    );
    await queryRunner.query(
      `CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nome" character varying(120) NOT NULL, "email" character varying(160) NOT NULL, "senha_hash" character varying(120) NOT NULL, "perfil" "public"."usuarios_perfil_enum" NOT NULL DEFAULT 'ORGANIZADOR', "ativo" boolean NOT NULL DEFAULT true, "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletado_em" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_usuarios_email" ON "usuarios" ("email") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_usuarios_email"`);
    await queryRunner.query(`DROP TABLE "usuarios"`);
    await queryRunner.query(`DROP TYPE "public"."usuarios_perfil_enum"`);
  }
}
