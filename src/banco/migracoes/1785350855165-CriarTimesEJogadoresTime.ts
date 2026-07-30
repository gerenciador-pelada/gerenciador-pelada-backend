import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Esta migracao precisa funcionar na posicao indicada pelo timestamp.
 *
 * A versao gerada automaticamente alterava tabelas de participantes, fila,
 * partidas e historico que so sao criadas por migracoes posteriores. Isso
 * funcionava em bancos antigos, onde ela foi acrescentada depois, mas quebrava
 * toda instalacao limpa. As chaves que dependem dessas tabelas ficam agora nas
 * respectivas migracoes de criacao.
 */
export class CriarTimesEJogadoresTime1785350855165 implements MigrationInterface {
  name = 'CriarTimesEJogadoresTime1785350855165';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "times" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pelada_id" uuid NOT NULL, "nome" character varying(40) NOT NULL, "cor" character varying(20), "ordem_criacao" integer NOT NULL, "partidas_consecutivas" integer NOT NULL DEFAULT '0', "vitorias_consecutivas" integer NOT NULL DEFAULT '0', "ativo" boolean NOT NULL DEFAULT true, "dissolvido_em" TIMESTAMP WITH TIME ZONE, "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_21a9ce7a877cba720e30089638e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_209becd63f8830868e0cdf5f5d" ON "times" ("pelada_id", "ativo")`,
    );
    await queryRunner.query(
      `CREATE TABLE "jogadores_time" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "time_id" uuid NOT NULL, "participante_id" uuid NOT NULL, "eh_goleiro" boolean NOT NULL DEFAULT false, "ativo" boolean NOT NULL DEFAULT true, "entrou_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "saiu_em" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_9826deecce6141bfe7efeadfbf8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_jogadores_time_ativo" ON "jogadores_time" ("time_id", "participante_id") WHERE "ativo" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_jogadores_time_ativo"`);
    await queryRunner.query(`DROP TABLE "jogadores_time"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_209becd63f8830868e0cdf5f5d"`,
    );
    await queryRunner.query(`DROP TABLE "times"`);
  }
}
