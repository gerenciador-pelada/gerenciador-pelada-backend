import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarPausaNaPartida1785500000000
  implements MigrationInterface
{
  name = 'AdicionarPausaNaPartida1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `segundos_acumulados` com NOT NULL DEFAULT 0: as partidas que ja existem
    // nunca foram pausadas, entao zero e o valor correto para elas e o
    // cronometro continua derivando de `iniciada_em` como antes.
    await queryRunner.query(
      `ALTER TABLE "partidas" ADD COLUMN "pausada_em" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" ADD COLUMN "segundos_acumulados" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" ADD CONSTRAINT "chk_partida_segundos_acumulados" CHECK ("segundos_acumulados" >= 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partidas" DROP CONSTRAINT "chk_partida_segundos_acumulados"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" DROP COLUMN "segundos_acumulados"`,
    );
    await queryRunner.query(`ALTER TABLE "partidas" DROP COLUMN "pausada_em"`);
  }
}
