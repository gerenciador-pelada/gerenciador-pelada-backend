import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarAcertoFinanceiro1785520000000
  implements MigrationInterface
{
  name = 'AdicionarAcertoFinanceiro1785520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Centavos em integer, e nao numeric/decimal: o rateio precisa fechar com
    // o total, e centavo inteiro elimina a classe inteira de erro de
    // arredondamento antes que ela exista.
    await queryRunner.query(
      `ALTER TABLE "peladas" ADD COLUMN "valor_campo_centavos" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" ADD CONSTRAINT "chk_peladas_valor_campo" CHECK ("valor_campo_centavos" IS NULL OR "valor_campo_centavos" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" ADD COLUMN "goleiro_fixo_paga" boolean NOT NULL DEFAULT true`,
    );
    // Default false: quem ja existia nao pagou nada ainda, e marcar como pago
    // por omissao esconderia divida real.
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" ADD COLUMN "pagou" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "participantes_pelada" DROP COLUMN "pagou"`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" DROP COLUMN "goleiro_fixo_paga"`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" DROP CONSTRAINT "chk_peladas_valor_campo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" DROP COLUMN "valor_campo_centavos"`,
    );
  }
}
