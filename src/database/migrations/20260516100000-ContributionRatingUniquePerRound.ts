import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContributionRatingUniquePerRound20260516100000 implements MigrationInterface {
  name = 'ContributionRatingUniquePerRound20260516100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old per-task-ever unique constraint
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT IF EXISTS "UQ_task_rater"`,
    );

    // Allow one rating per (task, rater, round) so multiple evaluation rounds work
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "UQ_task_rater_round" UNIQUE ("task_id", "rater_id", "round_started_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT IF EXISTS "UQ_task_rater_round"`,
    );

    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "UQ_task_rater" UNIQUE ("task_id", "rater_id")`,
    );
  }
}
