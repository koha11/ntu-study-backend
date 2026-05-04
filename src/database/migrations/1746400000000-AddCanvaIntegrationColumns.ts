import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCanvaIntegrationColumns1746400000000
  implements MigrationInterface
{
  name = 'AddCanvaIntegrationColumns1746400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "canva_access_token" text
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "canva_refresh_token" text
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "canva_token_expires_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "groups"
      ADD COLUMN "canva_design_id" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "groups" DROP COLUMN "canva_design_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "canva_token_expires_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "canva_refresh_token"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "canva_access_token"
    `);
  }
}
