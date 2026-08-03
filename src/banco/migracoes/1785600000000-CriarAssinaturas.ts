import { MigrationInterface, QueryRunner } from 'typeorm';

export class CriarAssinaturas1785600000000 implements MigrationInterface {
  name = 'CriarAssinaturas1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."assinaturas_status_enum" AS ENUM('ATIVA', 'VENCIDA', 'CANCELADA')`,
    );

    // `usuario_id` unico: duas assinaturas ativas para a mesma pessoa seria
    // cobranca dobrada. O banco recusa antes de o codigo ter chance de errar.
    //
    // `asaas_assinatura_id` unico: o webhook chega mais de uma vez para o
    // mesmo evento (o Asaas repete ate receber 200), e a chave e o que permite
    // tratar a repeticao como no-op em vez de criar linha duplicada.
    await queryRunner.query(
      `CREATE TABLE "assinaturas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "usuario_id" uuid NOT NULL,
        "asaas_cliente_id" character varying(60) NOT NULL,
        "asaas_assinatura_id" character varying(60) NOT NULL,
        "status" "public"."assinaturas_status_enum" NOT NULL,
        "valor_centavos" integer NOT NULL,
        "ciclo" character varying(20) NOT NULL,
        "acesso_ate" TIMESTAMP WITH TIME ZONE,
        "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assinaturas" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_assinaturas_usuario" UNIQUE ("usuario_id"),
        CONSTRAINT "chk_assinaturas_valor" CHECK ("valor_centavos" > 0)
      )`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_assinaturas_asaas" ON "assinaturas" ("asaas_assinatura_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "assinaturas" ADD CONSTRAINT "FK_assinaturas_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assinaturas" DROP CONSTRAINT "FK_assinaturas_usuario"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_assinaturas_asaas"`);
    await queryRunner.query(`DROP TABLE "assinaturas"`);
    await queryRunner.query(`DROP TYPE "public"."assinaturas_status_enum"`);
  }
}
