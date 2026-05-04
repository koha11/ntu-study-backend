import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes a stale unique on (group_id, rater_id, ratee_id) without round_started_at.
 * That index blocks opening a second evaluation round for the same member pairs.
 * TypeORM synchronize or an older schema may have created "UQ_8676bae96596134387cf1f42a5b".
 */
export class DropStaleContributionRatingUnique1746300000000
  implements MigrationInterface
{
  name = 'DropStaleContributionRatingUnique1746300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT IF EXISTS "UQ_8676bae96596134387cf1f42a5b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT IF EXISTS "UQ_1e5c50e41e1a0a3bccf4f5c5f5f"`,
    );
    await queryRunner.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'contribution_ratings'
      AND c.conname = 'UQ_contribution_round_pair'
  ) THEN
    ALTER TABLE "contribution_ratings"
      ADD CONSTRAINT "UQ_contribution_round_pair"
      UNIQUE ("group_id", "round_started_at", "rater_id", "ratee_id");
  END IF;
END $$;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT IF EXISTS "UQ_contribution_round_pair"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "UQ_1e5c50e41e1a0a3bccf4f5c5f5f" UNIQUE ("group_id", "rater_id", "ratee_id")`,
    );
  }
}
