import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskOutcomeFields1750000000001 implements MigrationInterface {
  name = 'AddTaskOutcomeFields1750000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."tasks_expected_outcome_type_enum" AS ENUM('none', 'document', 'presentation', 'code', 'other')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "expected_outcome_type" "public"."tasks_expected_outcome_type_enum" NOT NULL DEFAULT 'none'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "expected_outcome_description" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "drive_folder_id" character varying(255)`,
    );
    await queryRunner.query(
      `CREATE TABLE "task_outcome_links" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"task_id" uuid NOT NULL, ` +
        `"url" text NOT NULL, ` +
        `"label" character varying(255), ` +
        `"created_by_id" uuid, ` +
        `CONSTRAINT "PK_task_outcome_links" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_outcome_links_task_id" ON "task_outcome_links" ("task_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_outcome_links" ADD CONSTRAINT "FK_task_outcome_links_task_id" ` +
        `FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_outcome_links" ADD CONSTRAINT "FK_task_outcome_links_created_by" ` +
        `FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_outcome_links" DROP CONSTRAINT "FK_task_outcome_links_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_outcome_links" DROP CONSTRAINT "FK_task_outcome_links_task_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_task_outcome_links_task_id"`,
    );
    await queryRunner.query(`DROP TABLE "task_outcome_links"`);
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "drive_folder_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "expected_outcome_description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "expected_outcome_type"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."tasks_expected_outcome_type_enum"`,
    );
  }
}
