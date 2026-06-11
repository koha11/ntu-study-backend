import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupLockedAt1749999999999 implements MigrationInterface {
  name = 'AddGroupLockedAt1749999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "groups" ADD "locked_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "groups" DROP COLUMN "locked_at"`);
  }
}
