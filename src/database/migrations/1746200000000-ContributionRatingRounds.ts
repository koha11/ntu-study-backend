import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContributionRatingRounds1746200000000 implements MigrationInterface {
  name = 'ContributionRatingRounds1746200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD "round_started_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD "is_round_closed" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ALTER COLUMN "score" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT IF EXISTS "CHK_score_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "CHK_score_range" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 10))`,
    );
    await queryRunner.query(
      `UPDATE "contribution_ratings" SET "round_started_at" = "created_at", "is_round_closed" = true WHERE "round_started_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ALTER COLUMN "round_started_at" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT IF EXISTS "UQ_1e5c50e41e1a0a3bccf4f5c5f5f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "UQ_contribution_round_pair" UNIQUE ("group_id", "round_started_at", "rater_id", "ratee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_contribution_group_round" ON "contribution_ratings" ("group_id", "round_started_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_contribution_group_rater_round" ON "contribution_ratings" ("group_id", "rater_id", "round_started_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_contribution_group_rater_round"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_contribution_group_round"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT "UQ_contribution_round_pair"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "UQ_1e5c50e41e1a0a3bccf4f5c5f5f" UNIQUE ("group_id", "rater_id", "ratee_id")`,
    );
    await queryRunner.query(
      `DELETE FROM "contribution_ratings" WHERE "score" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT "CHK_score_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "CHK_score_range" CHECK ("score" >= 0 AND "score" <= 10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ALTER COLUMN "score" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP COLUMN "is_round_closed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP COLUMN "round_started_at"`,
    );
  }
}
