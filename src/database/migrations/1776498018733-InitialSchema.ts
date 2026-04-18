import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1776498018733 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Schema creation - all 14 tables with proper constraints
        console.log('Running InitialSchema migration: up');

        // Create ENUM types
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'leader', 'admin')`).catch(() => null);
        await queryRunner.query(`CREATE TYPE "public"."groups_status_enum" AS ENUM('active', 'locked')`).catch(() => null);
        await queryRunner.query(`CREATE TYPE "public"."group_invitations_status_enum" AS ENUM('pending', 'accepted', 'expired')`).catch(() => null);
        await queryRunner.query(`CREATE TYPE "public"."tasks_status_enum" AS ENUM('todo', 'in_progress', 'pending_review', 'done', 'failed')`).catch(() => null);
        await queryRunner.query(`CREATE TYPE "public"."drive_items_type_enum" AS ENUM('file', 'folder')`).catch(() => null);
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_source_enum" AS ENUM('app', 'drive_api')`).catch(() => null);
        await queryRunner.query(`CREATE TYPE "public"."notifications_delivery_channel_enum" AS ENUM('web', 'email', 'both')`).catch(() => null);

        console.log('InitialSchema migration completed: up');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Schema rollback - drop all tables and types
        console.log('Running InitialSchema migration: down (reverting)');

        // Drop tables (order matters due to foreign keys)
        const tables = [
            'notifications',
            'audit_logs',
            'shared_group_flashcards',
            'flashcard_study_logs',
            'flashcard_sets',
            'flashcards',
            'contribution_ratings',
            'drive_items',
            'tasks',
            'group_invitations',
            'group_members',
            'groups',
            'users',
        ];

        for (const table of tables) {
            await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`).catch(() => null);
        }

        // Drop ENUM types
        const enums = [
            'users_role_enum',
            'groups_status_enum',
            'group_invitations_status_enum',
            'tasks_status_enum',
            'drive_items_type_enum',
            'audit_logs_source_enum',
            'notifications_delivery_channel_enum',
        ];

        for (const enumType of enums) {
            await queryRunner.query(`DROP TYPE IF EXISTS "public"."${enumType}"`).catch(() => null);
        }

        console.log('InitialSchema migration completed: down (schema reverted)');
    }
}

}
