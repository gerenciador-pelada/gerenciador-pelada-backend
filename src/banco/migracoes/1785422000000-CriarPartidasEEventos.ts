import { MigrationInterface, QueryRunner } from 'typeorm';
export class CriarPartidasEEventos1785422000000 implements MigrationInterface {
  name = 'CriarPartidasEEventos1785422000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE "public"."partidas_status_enum" AS ENUM('AGUARDANDO','EM_ANDAMENTO','FINALIZADA','CANCELADA')`,
    );
    await q.query(
      `CREATE TYPE "public"."eventos_partida_tipo_enum" AS ENUM('GOL','GOL_CONTRA','BOLA_CHEIA','BOLA_MURCHA','ENTRADA','SAIDA','LESAO')`,
    );
    await q.query(
      `CREATE TABLE "partidas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(),"pelada_id" uuid NOT NULL,"numero" integer NOT NULL,"time_casa_id" uuid NOT NULL,"time_visitante_id" uuid NOT NULL,"gols_casa" integer NOT NULL DEFAULT 0,"gols_visitante" integer NOT NULL DEFAULT 0,"status" "public"."partidas_status_enum" NOT NULL DEFAULT 'AGUARDANDO',"iniciada_em" TIMESTAMP WITH TIME ZONE,"finalizada_em" TIMESTAMP WITH TIME ZONE,"criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),"atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),CONSTRAINT "PK_partidas" PRIMARY KEY("id"),CONSTRAINT "uq_partidas_numero" UNIQUE("pelada_id","numero"))`,
    );
    await q.query(
      `CREATE TABLE "participacoes_partida" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(),"partida_id" uuid NOT NULL,"participante_id" uuid NOT NULL,"time_id" uuid NOT NULL,"eh_goleiro" boolean NOT NULL DEFAULT false,"entrou_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),"saiu_em" TIMESTAMP WITH TIME ZONE,"minutos_jogados" integer,CONSTRAINT "PK_participacoes_partida" PRIMARY KEY("id"),CONSTRAINT "uq_participacao" UNIQUE("partida_id","participante_id"))`,
    );
    await q.query(
      `CREATE TABLE "eventos_partida" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(),"partida_id" uuid NOT NULL,"tipo" "public"."eventos_partida_tipo_enum" NOT NULL,"participante_id" uuid NOT NULL,"participante_relacionado_id" uuid,"time_id" uuid NOT NULL,"minuto" integer,"registrado_por_id" uuid NOT NULL,"criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),"deletado_em" TIMESTAMP WITH TIME ZONE,CONSTRAINT "PK_eventos_partida" PRIMARY KEY("id"))`,
    );
    await q.query(
      `ALTER TABLE "participacoes_partida" ADD CONSTRAINT "FK_b985b4922d31134676b84311543" FOREIGN KEY ("partida_id") REFERENCES "partidas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "participacoes_partida" ADD CONSTRAINT "FK_a515f696e8fd16e464197f01151" FOREIGN KEY ("participante_id") REFERENCES "participantes_pelada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "participacoes_partida" ADD CONSTRAINT "FK_72fa00f309e73b6af2c56df3e0c" FOREIGN KEY ("time_id") REFERENCES "times"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "eventos_partida" ADD CONSTRAINT "FK_ff48077d47e13820cf6b8e7773e" FOREIGN KEY ("partida_id") REFERENCES "partidas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "eventos_partida" ADD CONSTRAINT "FK_94d6fb9cba2ca46d8461b05eca7" FOREIGN KEY ("participante_id") REFERENCES "participantes_pelada"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "eventos_partida" DROP CONSTRAINT "FK_94d6fb9cba2ca46d8461b05eca7"`,
    );
    await q.query(
      `ALTER TABLE "eventos_partida" DROP CONSTRAINT "FK_ff48077d47e13820cf6b8e7773e"`,
    );
    await q.query(
      `ALTER TABLE "participacoes_partida" DROP CONSTRAINT "FK_72fa00f309e73b6af2c56df3e0c"`,
    );
    await q.query(
      `ALTER TABLE "participacoes_partida" DROP CONSTRAINT "FK_a515f696e8fd16e464197f01151"`,
    );
    await q.query(
      `ALTER TABLE "participacoes_partida" DROP CONSTRAINT "FK_b985b4922d31134676b84311543"`,
    );
    await q.query(`DROP TABLE "eventos_partida"`);
    await q.query(`DROP TABLE "participacoes_partida"`);
    await q.query(`DROP TABLE "partidas"`);
    await q.query(`DROP TYPE "public"."eventos_partida_tipo_enum"`);
    await q.query(`DROP TYPE "public"."partidas_status_enum"`);
  }
}
