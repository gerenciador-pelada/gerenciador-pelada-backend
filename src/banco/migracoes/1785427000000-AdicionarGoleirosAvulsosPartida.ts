import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarGoleirosAvulsosPartida1785427000000 implements MigrationInterface {
  name = 'AdicionarGoleirosAvulsosPartida1785427000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partidas" ADD "goleiro_casa_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" ADD "goleiro_visitante_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas"
        ADD CONSTRAINT "chk_partida_goleiros_avulsos_distintos"
        CHECK (
          "goleiro_casa_id" IS NULL
          OR "goleiro_visitante_id" IS NULL
          OR "goleiro_casa_id" <> "goleiro_visitante_id"
        )`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas"
        ADD CONSTRAINT "FK_partidas_goleiro_casa"
        FOREIGN KEY ("goleiro_casa_id")
        REFERENCES "participantes_pelada"("id")
        ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas"
        ADD CONSTRAINT "FK_partidas_goleiro_visitante"
        FOREIGN KEY ("goleiro_visitante_id")
        REFERENCES "participantes_pelada"("id")
        ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "partidas" DROP CONSTRAINT "FK_partidas_goleiro_visitante"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" DROP CONSTRAINT "FK_partidas_goleiro_casa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" DROP CONSTRAINT "chk_partida_goleiros_avulsos_distintos"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" DROP COLUMN "goleiro_visitante_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" DROP COLUMN "goleiro_casa_id"`,
    );
  }
}
