import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guarda a posicao que cada jogador tinha na fila quando o time foi formado.
 *
 * Sem isto a ordem interna do time nao existia em lugar nenhum: o elenco era
 * lido por consulta sem `ORDER BY`, e quando o time perdia a rotacao remontava
 * a fila por `ordem_chegada` — a que horas a pessoa apareceu na pelada, que nao
 * tem relacao com ha quanto tempo ela esta esperando. Quem chegou por ultimo
 * caia para o fim do proprio grupo mesmo tendo sido o primeiro da fila.
 */
export class AdicionarOrdemEntradaJogadorTime1785550000000 implements MigrationInterface {
  name = 'AdicionarOrdemEntradaJogadorTime1785550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" ADD COLUMN "ordem_entrada" integer NOT NULL DEFAULT 0`,
    );

    // As peladas em andamento nao tem essa ordem gravada em lugar nenhum, entao
    // nao ha o que recuperar. `entrou_em` empata dentro do mesmo time (a
    // transacao inteira grava o mesmo `now()`), e o desempate por `id` e
    // arbitrario — mas arbitrario e estavel vale mais que a consulta sem ordem
    // que existia antes, que mudava de resposta entre duas leituras.
    await queryRunner.query(
      `UPDATE "jogadores_time" AS alvo
          SET "ordem_entrada" = numerado."posicao"
         FROM (
           SELECT "id",
                  row_number() OVER (
                    PARTITION BY "time_id"
                    ORDER BY "entrou_em", "id"
                  ) - 1 AS "posicao"
             FROM "jogadores_time"
         ) AS numerado
        WHERE alvo."id" = numerado."id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jogadores_time" DROP COLUMN "ordem_entrada"`,
    );
  }
}
