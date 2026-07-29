import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarPeladasEConfiguracoes1785338893590 implements MigrationInterface {
  name = 'CriarPeladasEConfiguracoes1785338893590';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."configuracoes_pelada_modalidade_goleiro_enum" AS ENUM('FIXO', 'ROTATIVO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."configuracoes_pelada_forma_escolha_times_iniciais_enum" AS ENUM('SORTEIO_ALEATORIO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."configuracoes_pelada_regra_empate_enum" AS ENUM('AMBOS_SAEM', 'MAIS_TEMPO_EM_CAMPO_SAI', 'DECISAO_IMEDIATA')`,
    );
    await queryRunner.query(
      `CREATE TABLE "configuracoes_pelada" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pelada_id" uuid NOT NULL, "jogadores_linha_por_time" integer NOT NULL DEFAULT '5', "quantidade_goleiros" integer NOT NULL DEFAULT '2', "modalidade_goleiro" "public"."configuracoes_pelada_modalidade_goleiro_enum" NOT NULL DEFAULT 'FIXO', "goleiros_alternam_times" boolean NOT NULL DEFAULT true, "forma_escolha_times_iniciais" "public"."configuracoes_pelada_forma_escolha_times_iniciais_enum" NOT NULL DEFAULT 'SORTEIO_ALEATORIO', "maximo_jogadores" integer NOT NULL DEFAULT '20', "duracao_partida_minutos" integer NOT NULL DEFAULT '10', "maximo_gols" integer, "permite_empate" boolean NOT NULL DEFAULT true, "regra_empate" "public"."configuracoes_pelada_regra_empate_enum" NOT NULL DEFAULT 'AMBOS_SAEM', "pontos_vitoria" integer NOT NULL DEFAULT '3', "pontos_empate" integer NOT NULL DEFAULT '1', "pontos_derrota" integer NOT NULL DEFAULT '0', "pontos_gol" integer NOT NULL DEFAULT '0', "pontos_assistencia" integer NOT NULL DEFAULT '0', "pontos_bola_cheia" integer NOT NULL DEFAULT '0', "pontos_bola_murcha" integer NOT NULL DEFAULT '0', "pontos_partida_goleiro" integer NOT NULL DEFAULT '0', "pontos_jogo_sem_sofrer_gol" integer NOT NULL DEFAULT '0', "criterios_desempate_ranking" jsonb NOT NULL DEFAULT '["VITORIAS","SALDO_GOLS","GOLS"]'::jsonb, "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_2796826d26b23453586298d85f" UNIQUE ("pelada_id"), CONSTRAINT "chk_configuracao_duracao" CHECK ("duracao_partida_minutos" BETWEEN 1 AND 120), CONSTRAINT "chk_configuracao_maximo_jogadores" CHECK ("maximo_jogadores" >= 2), CONSTRAINT "chk_configuracao_goleiros" CHECK ("quantidade_goleiros" BETWEEN 0 AND 4), CONSTRAINT "chk_configuracao_jogadores_linha" CHECK ("jogadores_linha_por_time" BETWEEN 1 AND 11), CONSTRAINT "PK_a21ed9568aad03eb43f5bb2ed20" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."peladas_status_enum" AS ENUM('ABERTA_INSCRICOES', 'EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA')`,
    );
    await queryRunner.query(
      `CREATE TABLE "peladas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizador_id" uuid NOT NULL, "local_id" uuid NOT NULL, "temporada_id" uuid, "nome" character varying(120) NOT NULL, "data_hora" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."peladas_status_enum" NOT NULL DEFAULT 'ABERTA_INSCRICOES', "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletado_em" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_69625e7c143885f82d2545b4dd9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_peladas_status" ON "peladas" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_peladas_organizador_data" ON "peladas" ("organizador_id", "data_hora") `,
    );
    await queryRunner.query(
      `ALTER TABLE "configuracoes_pelada" ADD CONSTRAINT "FK_2796826d26b23453586298d85f9" FOREIGN KEY ("pelada_id") REFERENCES "peladas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" ADD CONSTRAINT "FK_1c4dec63c5d3bea1951282ffb51" FOREIGN KEY ("organizador_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" ADD CONSTRAINT "FK_3acb100d4d2a04922bf99195450" FOREIGN KEY ("local_id") REFERENCES "locais_pelada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" ADD CONSTRAINT "FK_4a8c952f608bd677061d04e5591" FOREIGN KEY ("temporada_id") REFERENCES "temporadas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "peladas" DROP CONSTRAINT "FK_4a8c952f608bd677061d04e5591"`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" DROP CONSTRAINT "FK_3acb100d4d2a04922bf99195450"`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" DROP CONSTRAINT "FK_1c4dec63c5d3bea1951282ffb51"`,
    );
    await queryRunner.query(
      `ALTER TABLE "configuracoes_pelada" DROP CONSTRAINT "FK_2796826d26b23453586298d85f9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_peladas_organizador_data"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_peladas_status"`);
    await queryRunner.query(`DROP TABLE "peladas"`);
    await queryRunner.query(`DROP TYPE "public"."peladas_status_enum"`);
    await queryRunner.query(`DROP TABLE "configuracoes_pelada"`);
    await queryRunner.query(
      `DROP TYPE "public"."configuracoes_pelada_regra_empate_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."configuracoes_pelada_forma_escolha_times_iniciais_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."configuracoes_pelada_modalidade_goleiro_enum"`,
    );
  }
}
