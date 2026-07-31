import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarSubstituicaoTemporaria1785530000000 implements MigrationInterface {
  name = 'AdicionarSubstituicaoTemporaria1785530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" ADD COLUMN "substitui_participante_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" ADD CONSTRAINT "fk_jogadores_time_substitui_participante" FOREIGN KEY ("substitui_participante_id") REFERENCES "participantes_pelada"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_jogadores_time_substituicao_ativa" ON "jogadores_time" ("substitui_participante_id") WHERE "ativo" = true AND "substitui_participante_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_jogadores_time_substituicao_ativa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" DROP CONSTRAINT "fk_jogadores_time_substitui_participante"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" DROP COLUMN "substitui_participante_id"`,
    );
  }
}
