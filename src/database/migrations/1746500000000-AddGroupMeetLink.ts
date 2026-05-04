import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupMeetLink1746500000000 implements MigrationInterface {
  name = 'AddGroupMeetLink1746500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "groups"
      ADD COLUMN "meet_link" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "groups" DROP COLUMN "meet_link"
    `);
  }
}
