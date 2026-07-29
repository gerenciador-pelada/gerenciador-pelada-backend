import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarTimesEJogadoresTime1785350855165 implements MigrationInterface {
  name = 'CriarTimesEJogadoresTime1785350855165';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" DROP CONSTRAINT "FK_participantes_pelada_pelada"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" DROP CONSTRAINT "FK_participantes_pelada_jogador"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_historico_pelada_criado"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_fila_participante_ativo"`);
    await queryRunner.query(`DROP INDEX "public"."uq_fila_posicao_ativa"`);
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" DROP CONSTRAINT "uq_participantes_pelada_jogador"`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" DROP CONSTRAINT "uq_partidas_numero"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participacoes_partida" DROP CONSTRAINT "uq_participacao"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pontuacoes_jogador" DROP CONSTRAINT "uq_pontuacao_participante"`,
    );
    await queryRunner.query(
      `CREATE TABLE "times" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pelada_id" uuid NOT NULL, "nome" character varying(40) NOT NULL, "cor" character varying(20), "ordem_criacao" integer NOT NULL, "partidas_consecutivas" integer NOT NULL DEFAULT '0', "vitorias_consecutivas" integer NOT NULL DEFAULT '0', "ativo" boolean NOT NULL DEFAULT true, "dissolvido_em" TIMESTAMP WITH TIME ZONE, "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_21a9ce7a877cba720e30089638e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_209becd63f8830868e0cdf5f5d" ON "times" ("pelada_id", "ativo") `,
    );
    await queryRunner.query(
      `CREATE TABLE "jogadores_time" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "time_id" uuid NOT NULL, "participante_id" uuid NOT NULL, "eh_goleiro" boolean NOT NULL DEFAULT false, "ativo" boolean NOT NULL DEFAULT true, "entrou_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "saiu_em" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_9826deecce6141bfe7efeadfbf8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_jogadores_time_ativo" ON "jogadores_time" ("time_id", "participante_id") WHERE "ativo" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "configuracoes_pelada" ALTER COLUMN "criterios_desempate_ranking" SET DEFAULT '["VITORIAS","SALDO_GOLS","GOLS"]'::jsonb`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_participantes_pelada_jogador" ON "participantes_pelada" ("pelada_id", "jogador_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5ff8765ddce1de1166a70367b6" ON "participacoes_partida" ("partida_id", "participante_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5a57185172d55e757ac2f1632e" ON "pontuacoes_jogador" ("partida_id", "participante_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1c7ec35077bc862b12aed8976e" ON "historico_acoes" ("pelada_id", "criado_em") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ae40eea91a2bd5b1cb0b320184" ON "fila_jogadores" ("pelada_id", "posicao") WHERE "ativo" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_478b2ede4f1dfb44f6e66459c4" ON "fila_jogadores" ("pelada_id", "participante_id") WHERE "ativo" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" ADD CONSTRAINT "FK_9660145295b8b10395d72ff4446" FOREIGN KEY ("pelada_id") REFERENCES "peladas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" ADD CONSTRAINT "FK_c81ea417c0170253c42ece90034" FOREIGN KEY ("jogador_id") REFERENCES "jogadores"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" DROP CONSTRAINT "FK_c81ea417c0170253c42ece90034"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" DROP CONSTRAINT "FK_9660145295b8b10395d72ff4446"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_478b2ede4f1dfb44f6e66459c4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae40eea91a2bd5b1cb0b320184"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1c7ec35077bc862b12aed8976e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5a57185172d55e757ac2f1632e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5ff8765ddce1de1166a70367b6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_participantes_pelada_jogador"`,
    );
    await queryRunner.query(
      `ALTER TABLE "configuracoes_pelada" ALTER COLUMN "criterios_desempate_ranking" SET DEFAULT '["VITORIAS", "SALDO_GOLS", "GOLS"]'`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_jogadores_time_ativo"`);
    await queryRunner.query(`DROP TABLE "jogadores_time"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_209becd63f8830868e0cdf5f5d"`,
    );
    await queryRunner.query(`DROP TABLE "times"`);
    await queryRunner.query(
      `ALTER TABLE "pontuacoes_jogador" ADD CONSTRAINT "uq_pontuacao_participante" UNIQUE ("partida_id", "participante_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "participacoes_partida" ADD CONSTRAINT "uq_participacao" UNIQUE ("partida_id", "participante_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "partidas" ADD CONSTRAINT "uq_partidas_numero" UNIQUE ("pelada_id", "numero")`,
    );
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" ADD CONSTRAINT "uq_participantes_pelada_jogador" UNIQUE ("pelada_id", "jogador_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_fila_posicao_ativa" ON "fila_jogadores" ("pelada_id", "posicao") WHERE (ativo = true)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_fila_participante_ativo" ON "fila_jogadores" ("pelada_id", "participante_id") WHERE (ativo = true)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_historico_pelada_criado" ON "historico_acoes" ("pelada_id", "criado_em") `,
    );
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" ADD CONSTRAINT "FK_participantes_pelada_jogador" FOREIGN KEY ("jogador_id") REFERENCES "jogadores"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" ADD CONSTRAINT "FK_participantes_pelada_pelada" FOREIGN KEY ("pelada_id") REFERENCES "peladas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
