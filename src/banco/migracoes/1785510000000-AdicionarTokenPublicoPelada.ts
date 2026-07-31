import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarTokenPublicoPelada1785510000000 implements MigrationInterface {
  name = 'AdicionarTokenPublicoPelada1785510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "peladas" ADD COLUMN "token_publico" character varying(64)`,
    );
    // UNIQUE, e nao so um indice: o token e a unica credencial do link
    // publico. Dois iguais dariam acesso cruzado entre peladas. NULL repete a
    // vontade no Postgres, entao revogar continua possivel para todas.
    await queryRunner.query(
      `ALTER TABLE "peladas" ADD CONSTRAINT "uq_peladas_token_publico" UNIQUE ("token_publico")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "peladas" DROP CONSTRAINT "uq_peladas_token_publico"`,
    );
    await queryRunner.query(
      `ALTER TABLE "peladas" DROP COLUMN "token_publico"`,
    );
  }
}
