import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Neste ponto da linha do tempo apenas times e jogadores_time ja existem.
 * As demais chaves estrangeiras sao criadas junto das tabelas posteriores,
 * evitando referencias a relacoes que ainda nao existem num banco vazio.
 */
export class AdicionarChavesEstrangeiras1785381200518 implements MigrationInterface {
  name = 'AdicionarChavesEstrangeiras1785381200518';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" ADD CONSTRAINT "FK_978f40dd07335723fc02c576b8d" FOREIGN KEY ("time_id") REFERENCES "times"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" DROP CONSTRAINT "FK_978f40dd07335723fc02c576b8d"`,
    );
  }
}
