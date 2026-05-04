import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRefreshTokenVersion1745920800000
  implements MigrationInterface
{
  name = 'AddUserRefreshTokenVersion1745920800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "refresh_token_version" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "refresh_token_version"
    `);
  }
}
