import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPreferredLanguage20260516000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_preferred_language_enum" AS ENUM('en', 'vi')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "preferred_language" "public"."users_preferred_language_enum" NOT NULL DEFAULT 'vi'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "preferred_language"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."users_preferred_language_enum"`,
    );
  }
}
