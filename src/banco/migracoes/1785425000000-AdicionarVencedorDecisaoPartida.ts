import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarVencedorDecisaoPartida1785425000000 implements MigrationInterface {
  name = 'AdicionarVencedorDecisaoPartida1785425000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partidas" ADD "vencedor_decisao" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" ADD CONSTRAINT "CHK_partidas_vencedor_decisao" CHECK ("vencedor_decisao" IS NULL OR "vencedor_decisao" IN ('CASA', 'VISITANTE'))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partidas" DROP CONSTRAINT "CHK_partidas_vencedor_decisao"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" DROP COLUMN "vencedor_decisao"`,
    );
  }
}
