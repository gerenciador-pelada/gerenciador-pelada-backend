import { MigrationInterface, QueryRunner } from 'typeorm';

export class AumentarMaximoJogadoresPadrao1785530000000 implements MigrationInterface {
  name = 'AumentarMaximoJogadoresPadrao1785530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "configuracoes_pelada" ALTER COLUMN "maximo_jogadores" SET DEFAULT 40`,
    );
    // As edicoes que ja existem e nunca tiveram o limite mexido tambem sobem:
    // elas herdaram o 20 por omissao, nao por escolha do organizador. Quem
    // ajustou o valor de proposito fica como esta.
    await queryRunner.query(
      `UPDATE "configuracoes_pelada" SET "maximo_jogadores" = 40 WHERE "maximo_jogadores" = 20`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "configuracoes_pelada" ALTER COLUMN "maximo_jogadores" SET DEFAULT 20`,
    );
    await queryRunner.query(
      `UPDATE "configuracoes_pelada" SET "maximo_jogadores" = 20 WHERE "maximo_jogadores" = 40`,
    );
  }
}
