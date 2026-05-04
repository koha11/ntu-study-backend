import { MigrationInterface, QueryRunner } from 'typeorm';

export class CronJobRuns1746600000000 implements MigrationInterface {
  name = 'CronJobRuns1746600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."cron_job_runs_status_enum" AS ENUM('running', 'success', 'failure')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cron_job_runs_triggered_by_enum" AS ENUM('cron', 'manual')`,
    );
    await queryRunner.query(`
            CREATE TABLE "cron_job_runs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "job_name" character varying(128) NOT NULL,
                "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "finished_at" TIMESTAMP WITH TIME ZONE,
                "status" "public"."cron_job_runs_status_enum" NOT NULL,
                "error_message" text,
                "triggered_by" "public"."cron_job_runs_triggered_by_enum" NOT NULL,
                CONSTRAINT "PK_cron_job_runs" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cron_job_runs_job_name" ON "cron_job_runs" ("job_name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cron_job_runs_started_at" ON "cron_job_runs" ("started_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_cron_job_runs_started_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cron_job_runs_job_name"`);
    await queryRunner.query(`DROP TABLE "cron_job_runs"`);
    await queryRunner.query(`DROP TYPE "public"."cron_job_runs_triggered_by_enum"`);
    await queryRunner.query(`DROP TYPE "public"."cron_job_runs_status_enum"`);
  }
}
