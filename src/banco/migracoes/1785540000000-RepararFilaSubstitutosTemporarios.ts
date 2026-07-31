import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepararFilaSubstitutosTemporarios1785540000000 implements MigrationInterface {
  name = 'RepararFilaSubstitutosTemporarios1785540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Versoes anteriores removiam o substituto da fila ao criar a cobertura.
    // A posicao antiga ja nao existe, portanto somente esses registros legados
    // sao anexados ao fim; as novas coberturas preservam a posicao original.
    await queryRunner.query(`
      WITH faltantes AS (
        SELECT
          t."pelada_id",
          jt."participante_id",
          ROW_NUMBER() OVER (
            PARTITION BY t."pelada_id"
            ORDER BY jt."entrou_em", jt."id"
          ) AS deslocamento
        FROM "jogadores_time" jt
        INNER JOIN "times" t ON t."id" = jt."time_id"
        WHERE jt."ativo" = true
          AND jt."substitui_participante_id" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "fila_jogadores" f
            WHERE f."pelada_id" = t."pelada_id"
              AND f."participante_id" = jt."participante_id"
              AND f."ativo" = true
          )
      ), maximos AS (
        SELECT
          p."id" AS "pelada_id",
          COALESCE(MAX(f."posicao") FILTER (WHERE f."ativo" = true), 0) AS maximo
        FROM "peladas" p
        LEFT JOIN "fila_jogadores" f ON f."pelada_id" = p."id"
        GROUP BY p."id"
      )
      INSERT INTO "fila_jogadores" (
        "pelada_id",
        "participante_id",
        "posicao",
        "ativo",
        "saiu_em"
      )
      SELECT
        faltantes."pelada_id",
        faltantes."participante_id",
        maximos.maximo + faltantes.deslocamento,
        true,
        NULL
      FROM faltantes
      INNER JOIN maximos ON maximos."pelada_id" = faltantes."pelada_id"
    `);
  }

  public async down(): Promise<void> {
    // Reparo de dados intencionalmente irreversivel: nao ha como distinguir
    // com seguranca uma entrada restaurada de uma depois editada pelo admin.
  }
}
