import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarChavesEstrangeiras1785381200518 implements MigrationInterface {
  name = 'AdicionarChavesEstrangeiras1785381200518';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "configuracoes_pelada" ALTER COLUMN "criterios_desempate_ranking" SET DEFAULT '["VITORIAS","SALDO_GOLS","GOLS"]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "participacoes_partida" ADD CONSTRAINT "FK_b985b4922d31134676b84311543" FOREIGN KEY ("partida_id") REFERENCES "partidas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participacoes_partida" ADD CONSTRAINT "FK_a515f696e8fd16e464197f01151" FOREIGN KEY ("participante_id") REFERENCES "participantes_pelada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participacoes_partida" ADD CONSTRAINT "FK_72fa00f309e73b6af2c56df3e0c" FOREIGN KEY ("time_id") REFERENCES "times"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" ADD CONSTRAINT "FK_978f40dd07335723fc02c576b8d" FOREIGN KEY ("time_id") REFERENCES "times"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" ADD CONSTRAINT "FK_3beb1cefc5e3f73702be0b0b735" FOREIGN KEY ("participante_id") REFERENCES "participantes_pelada"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "eventos_partida" ADD CONSTRAINT "FK_ff48077d47e13820cf6b8e7773e" FOREIGN KEY ("partida_id") REFERENCES "partidas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "eventos_partida" ADD CONSTRAINT "FK_94d6fb9cba2ca46d8461b05eca7" FOREIGN KEY ("participante_id") REFERENCES "participantes_pelada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "fila_jogadores" ADD CONSTRAINT "FK_825bdadb8a71695ebb26788c2ce" FOREIGN KEY ("participante_id") REFERENCES "participantes_pelada"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "fila_jogadores" DROP CONSTRAINT "FK_825bdadb8a71695ebb26788c2ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "eventos_partida" DROP CONSTRAINT "FK_94d6fb9cba2ca46d8461b05eca7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "eventos_partida" DROP CONSTRAINT "FK_ff48077d47e13820cf6b8e7773e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" DROP CONSTRAINT "FK_3beb1cefc5e3f73702be0b0b735"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" DROP CONSTRAINT "FK_978f40dd07335723fc02c576b8d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participacoes_partida" DROP CONSTRAINT "FK_72fa00f309e73b6af2c56df3e0c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participacoes_partida" DROP CONSTRAINT "FK_a515f696e8fd16e464197f01151"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participacoes_partida" DROP CONSTRAINT "FK_b985b4922d31134676b84311543"`,
    );
    await queryRunner.query(
      `ALTER TABLE "configuracoes_pelada" ALTER COLUMN "criterios_desempate_ranking" SET DEFAULT '["VITORIAS", "SALDO_GOLS", "GOLS"]'`,
    );
  }
}
