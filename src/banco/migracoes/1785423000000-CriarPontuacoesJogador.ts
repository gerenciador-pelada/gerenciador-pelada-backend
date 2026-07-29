import { MigrationInterface, QueryRunner } from 'typeorm';
export class CriarPontuacoesJogador1785423000000 implements MigrationInterface {
  name = 'CriarPontuacoesJogador1785423000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "pontuacoes_jogador" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(),"pelada_id" uuid NOT NULL,"partida_id" uuid NOT NULL,"participante_id" uuid NOT NULL,"jogador_id" uuid NOT NULL,"pontos_vitoria" integer NOT NULL DEFAULT 0,"pontos_gols" integer NOT NULL DEFAULT 0,"pontos_assistencias" integer NOT NULL DEFAULT 0,"pontos_bola_cheia" integer NOT NULL DEFAULT 0,"pontos_bola_murcha" integer NOT NULL DEFAULT 0,"pontos_total" integer NOT NULL DEFAULT 0,"calculado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),CONSTRAINT "PK_pontuacoes_jogador" PRIMARY KEY("id"),CONSTRAINT "uq_pontuacao_participante" UNIQUE("partida_id","participante_id"))`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "pontuacoes_jogador"`);
  }
}
