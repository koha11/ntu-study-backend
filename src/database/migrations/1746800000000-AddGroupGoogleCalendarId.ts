import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupGoogleCalendarId1746800000000 implements MigrationInterface {
  name = 'AddGroupGoogleCalendarId1746800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "groups"
      ADD COLUMN "google_calendar_id" character varying(512)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "groups" DROP COLUMN "google_calendar_id"
    `);
  }
}
