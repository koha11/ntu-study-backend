import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlashcardSetSubjectDescription1746700000000
  implements MigrationInterface
{
  name = 'AddFlashcardSetSubjectDescription1746700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flashcard_sets" ADD "subject" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_sets" ADD "description" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flashcard_sets" DROP COLUMN "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_sets" DROP COLUMN "subject"`,
    );
  }
}
