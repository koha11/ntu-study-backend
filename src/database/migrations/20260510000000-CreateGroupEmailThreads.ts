import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroupEmailThreads20260510000000
  implements MigrationInterface
{
  name = 'CreateGroupEmailThreads20260510000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "group_email_threads" (
        "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "group_id"          UUID        NOT NULL,
        "user_id"           UUID        NOT NULL,
        "thread_message_id" VARCHAR(512) NOT NULL,
        CONSTRAINT "PK_group_email_threads" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_group_email_threads_group_user" UNIQUE ("group_id", "user_id"),
        CONSTRAINT "FK_group_email_threads_group"
          FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_group_email_threads_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_group_email_threads_group_id" ON "group_email_threads" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_group_email_threads_user_id" ON "group_email_threads" ("user_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "group_email_threads"`);
  }
}
