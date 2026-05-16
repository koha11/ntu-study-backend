import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContributionRatingTaskBased1776600000000 implements MigrationInterface {
  name = 'ContributionRatingTaskBased1776600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add task_id column (if it doesn't exist)
    const hasTaskColumn = await queryRunner.hasColumn('contribution_ratings', 'task_id');
    if (!hasTaskColumn) {
      await queryRunner.query(
        `ALTER TABLE "contribution_ratings" ADD "task_id" uuid`,
      );

      // Add foreign key constraint for task_id
      await queryRunner.query(
        `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "FK_contribution_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE`,
      );
    }

    // Drop the old unique constraint (if it exists)
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT IF EXISTS "UQ_contribution_round_pair"`,
    );

    // Drop the old check constraint that checked rater != ratee (if it exists)
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT IF EXISTS "CHK_rater_id_ratee_id"`,
    );

    // Drop ratee_id column (if it exists)
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP COLUMN IF EXISTS "ratee_id"`,
    );

    // Create new unique constraint on task and rater (one rating per task per rater ever)
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "UQ_task_rater" UNIQUE ("task_id", "rater_id")`,
    );

    // Add index for task lookups
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_contribution_task" ON "contribution_ratings" ("task_id")`,
    );

    // Make task_id NOT NULL after ensuring all existing rows have a task
    // For existing rows, we cannot assign tasks retroactively, so we delete orphaned ratings
    await queryRunner.query(
      `DELETE FROM "contribution_ratings" WHERE "task_id" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ALTER COLUMN "task_id" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate ratee_id column (if it doesn't exist)
    const hasRateeColumn = await queryRunner.hasColumn('contribution_ratings', 'ratee_id');
    if (!hasRateeColumn) {
      await queryRunner.query(
        `ALTER TABLE "contribution_ratings" ADD "ratee_id" uuid`,
      );
    }

    // Drop the new unique constraint (if it exists)
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT IF EXISTS "UQ_task_rater"`,
    );

    // Drop task index (if it exists)
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_contribution_task"`);

    // Drop task foreign key (if it exists)
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT IF EXISTS "FK_contribution_task"`,
    );

    // Drop task_id column (if it exists)
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP COLUMN IF EXISTS "task_id"`,
    );

    // Recreate the old check constraint (if it doesn't exist)
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT IF NOT EXISTS "CHK_rater_id_ratee_id" CHECK ("rater_id" != "ratee_id")`,
    );

    // Recreate the old unique constraint (if it doesn't exist)
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT IF NOT EXISTS "UQ_contribution_round_pair" UNIQUE ("group_id", "round_started_at", "rater_id", "ratee_id")`,
    );
  }
}
