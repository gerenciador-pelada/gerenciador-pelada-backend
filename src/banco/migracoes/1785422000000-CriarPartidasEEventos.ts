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
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "eventos_partida"`);
    await q.query(`DROP TABLE "participacoes_partida"`);
    await q.query(`DROP TABLE "partidas"`);
    await q.query(`DROP TYPE "public"."eventos_partida_tipo_enum"`);
    await q.query(`DROP TYPE "public"."partidas_status_enum"`);
  }
}
