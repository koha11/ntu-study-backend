import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1776594176196 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types
    await queryRunner
      .query(
        `CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'leader', 'admin')`,
      )
      .catch(() => null);
    await queryRunner
      .query(
        `CREATE TYPE "public"."groups_status_enum" AS ENUM('active', 'locked')`,
      )
      .catch(() => null);
    await queryRunner
      .query(
        `CREATE TYPE "public"."group_invitations_status_enum" AS ENUM('pending', 'accepted', 'expired')`,
      )
      .catch(() => null);
    await queryRunner
      .query(
        `CREATE TYPE "public"."tasks_status_enum" AS ENUM('todo', 'in_progress', 'pending_review', 'done', 'failed')`,
      )
      .catch(() => null);
    await queryRunner
      .query(
        `CREATE TYPE "public"."drive_items_type_enum" AS ENUM('file', 'folder')`,
      )
      .catch(() => null);
    await queryRunner
      .query(
        `CREATE TYPE "public"."audit_logs_source_enum" AS ENUM('app', 'drive_api')`,
      )
      .catch(() => null);
    await queryRunner
      .query(
        `CREATE TYPE "public"."notifications_delivery_channel_enum" AS ENUM('web', 'email', 'both')`,
      )
      .catch(() => null);

    // Create users table
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "email" character varying(255) NOT NULL,
                "full_name" character varying(255) NOT NULL,
                "avatar_url" text,
                "role" "public"."users_role_enum" NOT NULL DEFAULT 'user',
                "google_access_token" text,
                "google_refresh_token" text,
                "token_expires_at" TIMESTAMP WITH TIME ZONE,
                "drive_total_quota" bigint,
                "drive_used_quota" bigint,
                "quota_last_updated" TIMESTAMP WITH TIME ZONE,
                "is_active" boolean NOT NULL DEFAULT true,
                "notification_enabled" boolean NOT NULL DEFAULT true,
                "last_login_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_9bd2fb68bb9830d99e3902b410" ON "users" ("role")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c5eae53401e7e00b46b2a5b7ed" ON "users" ("is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8e90f6f306f7b64cef3e04e22e" ON "users" ("created_at")`,
    );

    // Create groups table
    await queryRunner.query(`
            CREATE TABLE "groups" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "name" character varying(255) NOT NULL,
                "description" text,
                "leader_id" uuid NOT NULL,
                "report_date" date,
                "tags" text[] NOT NULL DEFAULT '{}',
                "status" "public"."groups_status_enum" NOT NULL DEFAULT 'active',
                "drive_folder_id" character varying(255),
                "canva_file_url" text,
                "doc_file_url" text,
                CONSTRAINT "PK_659d1483316abcc414b7b189738" PRIMARY KEY ("id"),
                CONSTRAINT "FK_00a4d5b5e49e2b6fec67c9b1b8a" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_6d2f20f737ea51ad2f1b98b34f" ON "groups" ("leader_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_af1b49b9a7c6fb5cf2b83e99f0" ON "groups" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4dc0bfd2ca46b9dd63d7ef8e3c" ON "groups" ("created_at")`,
    );

    // Create group_members table
    await queryRunner.query(`
            CREATE TABLE "group_members" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "group_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "is_active" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_a6f43000a82bc1a3e1b35f38bc5" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_42d1be60a2a8a9e4bdbf41b28ca" UNIQUE ("group_id", "user_id"),
                CONSTRAINT "FK_99e8328db8804b12461f1a5e5a3" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_ffc49d2f15cdc7ef20f4761bb58" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_0ebb2d5cedc4fa4cf3e3f7ffa2" ON "group_members" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5e5f60c1f50dc4efbed395b14a" ON "group_members" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f64e87e97861dd906b1b12c0d0" ON "group_members" ("is_active")`,
    );

    // Create group_invitations table
    await queryRunner.query(`
            CREATE TABLE "group_invitations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "group_id" uuid NOT NULL,
                "invited_by_id" uuid NOT NULL,
                "email" character varying(255),
                "token" character varying(512) NOT NULL,
                "status" "public"."group_invitations_status_enum" NOT NULL DEFAULT 'pending',
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_ee8da850e5a89e6b9d0850f8a25" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_ac48a8059202e5c36ac5f72a62a" UNIQUE ("token"),
                CONSTRAINT "FK_2da4e5ffc8f4e43c0a75b37e2e6" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_6b81e5aae2dd97c84e2ebc92a42" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_c60df6029e62b9558bc7aaede2" ON "group_invitations" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3f78c7b0b1fb78dd95a59b7c0f" ON "group_invitations" ("invited_by_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f63b47d8c95ad7de68e8eba31c" ON "group_invitations" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e5c80e94a4fa84de1fa4e3b5e1" ON "group_invitations" ("expires_at")`,
    );

    // Create tasks table
    await queryRunner.query(`
            CREATE TABLE "tasks" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "title" character varying(500) NOT NULL,
                "description" text,
                "group_id" uuid,
                "parent_task_id" uuid,
                "created_by_id" uuid NOT NULL,
                "assignee_id" uuid,
                "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'todo',
                "due_date" TIMESTAMP WITH TIME ZONE,
                "submitted_at" TIMESTAMP WITH TIME ZONE,
                "reviewed_at" TIMESTAMP WITH TIME ZONE,
                "reviewed_by_id" uuid,
                CONSTRAINT "PK_d3b326aef6b5e30f7781cdf52c7" PRIMARY KEY ("id"),
                CONSTRAINT "FK_0576ba1f25641cf40f5backward5c" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_62edc1ae35908c2cc86993cf467" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_4ad28a9d01b7f64d39619e46236" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_1911506dae2c30bd0034b1d9a78" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL,
                CONSTRAINT "FK_e7b8e5f5c7e81b34f3c0e5b5e52" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_08d523673e101febc969a0b584" ON "tasks" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4c8fbdb838a96e88490ae10db80" ON "tasks" ("created_by_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3e3a2eefc6da7cedbf26fd9afc" ON "tasks" ("assignee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ce5d43a8f5f3d34e0f1d0f5c7" ON "tasks" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_47c4b139bef628a06ca9b6bb94" ON "tasks" ("due_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a0e206c8e2ad5eb2c88d73f4e9" ON "tasks" ("parent_task_id")`,
    );

    // Create contribution_ratings table
    await queryRunner.query(`
            CREATE TABLE "contribution_ratings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "group_id" uuid NOT NULL,
                "rater_id" uuid NOT NULL,
                "ratee_id" uuid NOT NULL,
                "score" smallint NOT NULL,
                "due_date" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_6e3be1af60d37bc3e99fc44f27e" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_1e5c50e41e1a0a3bccf4f5c5f5f" UNIQUE ("group_id", "rater_id", "ratee_id"),
                CONSTRAINT "FK_d3a3c7f5c0e5e5f5f5f5f5f5f5f" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_3b8f30e1c9e9e9e9e9e9e9e9e9e" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_8c5c30e1c9e9e9e9e9e9e9e9e9e" FOREIGN KEY ("ratee_id") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "CHK_rater_not_ratee" CHECK ("rater_id" != "ratee_id"),
                CONSTRAINT "CHK_score_range" CHECK ("score" >= 0 AND "score" <= 10)
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_b5a5d5e5e5e5e5e5e5e5e5e5e5" ON "contribution_ratings" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c5a5d5e5e5e5e5e5e5e5e5e5e5" ON "contribution_ratings" ("rater_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d5a5d5e5e5e5e5e5e5e5e5e5e5" ON "contribution_ratings" ("ratee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e5a5d5e5e5e5e5e5e5e5e5e5e5" ON "contribution_ratings" ("due_date")`,
    );

    // Create flashcard_sets table
    await queryRunner.query(`
            CREATE TABLE "flashcard_sets" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "owner_id" uuid NOT NULL,
                "name" character varying(255) NOT NULL,
                "card_count" integer NOT NULL DEFAULT 0,
                CONSTRAINT "PK_2c9cd0d97edf481dcf11f96e3d9" PRIMARY KEY ("id"),
                CONSTRAINT "FK_b5c5e5e5e5e5e5e5e5e5e5e5e5e" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_f5f5e5e5e5e5e5e5e5e5e5e5e5" ON "flashcard_sets" ("owner_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_g5f5e5e5e5e5e5e5e5e5e5e5e5" ON "flashcard_sets" ("created_at")`,
    );

    // Create flashcards table
    await queryRunner.query(`
            CREATE TABLE "flashcards" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "set_id" uuid NOT NULL,
                "front" text NOT NULL,
                "back" text NOT NULL,
                CONSTRAINT "PK_71b9ccc8c4fa31d1a84beed2dd9" PRIMARY KEY ("id"),
                CONSTRAINT "FK_h5f5e5e5e5e5e5e5e5e5e5e5e5e" FOREIGN KEY ("set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_i5f5e5e5e5e5e5e5e5e5e5e5e5" ON "flashcards" ("set_id")`,
    );

    // Create flashcard_study_logs table
    await queryRunner.query(`
            CREATE TABLE "flashcard_study_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "user_id" uuid NOT NULL,
                "set_id" uuid NOT NULL,
                "score" smallint NOT NULL,
                "next_review_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_f7a5e5e5e5e5e5e5e5e5e5e5e5e" PRIMARY KEY ("id"),
                CONSTRAINT "FK_j5f5e5e5e5e5e5e5e5e5e5e5e5e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_k5f5e5e5e5e5e5e5e5e5e5e5e5e" FOREIGN KEY ("set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE,
                CONSTRAINT "CHK_score_0_100" CHECK ("score" >= 0 AND "score" <= 100)
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_l5f5e5e5e5e5e5e5e5e5e5e5e5" ON "flashcard_study_logs" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_m5f5e5e5e5e5e5e5e5e5e5e5e5" ON "flashcard_study_logs" ("set_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_n5f5e5e5e5e5e5e5e5e5e5e5e5" ON "flashcard_study_logs" ("next_review_at")`,
    );

    // Create shared_group_flashcards table
    await queryRunner.query(`
            CREATE TABLE "shared_group_flashcards" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "set_id" uuid NOT NULL,
                "group_id" uuid NOT NULL,
                CONSTRAINT "PK_o5f5e5e5e5e5e5e5e5e5e5e5e5e" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_p5f5e5e5e5e5e5e5e5e5e5e5e5e" UNIQUE ("set_id", "group_id"),
                CONSTRAINT "FK_q5f5e5e5e5e5e5e5e5e5e5e5e5e" FOREIGN KEY ("set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_r5f5e5e5e5e5e5e5e5e5e5e5e5e" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_s5f5e5e5e5e5e5e5e5e5e5e5e5" ON "shared_group_flashcards" ("set_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_t5f5e5e5e5e5e5e5e5e5e5e5e5" ON "shared_group_flashcards" ("group_id")`,
    );

    // Create drive_items table
    await queryRunner.query(`
            CREATE TABLE "drive_items" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "group_id" uuid NOT NULL,
                "drive_file_id" character varying(255) NOT NULL,
                "parent_drive_id" character varying(255),
                "mime_type" character varying(255) NOT NULL,
                "type" "public"."drive_items_type_enum" NOT NULL,
                "web_view_link" text,
                "file_size" bigint NOT NULL,
                "name" character varying(255),
                CONSTRAINT "PK_u5f5e5e5e5e5e5e5e5e5e5e5e5e" PRIMARY KEY ("id"),
                CONSTRAINT "FK_v5f5e5e5e5e5e5e5e5e5e5e5e5e" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_w5f5e5e5e5e5e5e5e5e5e5e5e5" ON "drive_items" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_x5f5e5e5e5e5e5e5e5e5e5e5e5" ON "drive_items" ("drive_file_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_y5f5e5e5e5e5e5e5e5e5e5e5e5" ON "drive_items" ("parent_drive_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_z5f5e5e5e5e5e5e5e5e5e5e5e5" ON "drive_items" ("mime_type")`,
    );

    // Create audit_logs table
    await queryRunner.query(`
            CREATE TABLE "audit_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "group_id" uuid NOT NULL,
                "actor_id" uuid,
                "action" character varying(100) NOT NULL,
                "description" text,
                "source" "public"."audit_logs_source_enum" NOT NULL DEFAULT 'app',
                "metadata" jsonb,
                CONSTRAINT "PK_aa5e5e5e5e5e5e5e5e5e5e5e5e5" PRIMARY KEY ("id"),
                CONSTRAINT "FK_bb5e5e5e5e5e5e5e5e5e5e5e5e5" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_cc5e5e5e5e5e5e5e5e5e5e5e5e5" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_dd5e5e5e5e5e5e5e5e5e5e5e5e" ON "audit_logs" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ee5e5e5e5e5e5e5e5e5e5e5e5e" ON "audit_logs" ("actor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ff5e5e5e5e5e5e5e5e5e5e5e5e" ON "audit_logs" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gg5e5e5e5e5e5e5e5e5e5e5e5e" ON "audit_logs" ("source")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_hh5e5e5e5e5e5e5e5e5e5e5e5e" ON "audit_logs" ("created_at")`,
    );

    // Create notifications table
    await queryRunner.query(`
            CREATE TABLE "notifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "recipient_id" uuid NOT NULL,
                "type" character varying(100) NOT NULL,
                "message" text NOT NULL,
                "is_read" boolean NOT NULL DEFAULT false,
                "delivery_channel" "public"."notifications_delivery_channel_enum" NOT NULL DEFAULT 'web',
                "related_entity_type" character varying(255),
                "related_entity_id" uuid,
                CONSTRAINT "PK_ii5e5e5e5e5e5e5e5e5e5e5e5e5" PRIMARY KEY ("id"),
                CONSTRAINT "FK_jj5e5e5e5e5e5e5e5e5e5e5e5e5" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_kk5e5e5e5e5e5e5e5e5e5e5e5e" ON "notifications" ("recipient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ll5e5e5e5e5e5e5e5e5e5e5e5e" ON "notifications" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mm5e5e5e5e5e5e5e5e5e5e5e5e" ON "notifications" ("is_read")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_nn5e5e5e5e5e5e5e5e5e5e5e5e" ON "notifications" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order of creation (due to foreign keys)
    const tables = [
      'notifications',
      'audit_logs',
      'drive_items',
      'shared_group_flashcards',
      'flashcard_study_logs',
      'flashcards',
      'flashcard_sets',
      'contribution_ratings',
      'tasks',
      'group_invitations',
      'group_members',
      'groups',
      'users',
    ];

    for (const table of tables) {
      await queryRunner
        .query(`DROP TABLE IF EXISTS "${table}" CASCADE`)
        .catch(() => null);
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
      await queryRunner
        .query(`DROP TYPE IF EXISTS "public"."${enumType}"`)
        .catch(() => null);
    }
  }
}
