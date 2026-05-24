import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1779199165939 implements MigrationInterface {
  name = 'InitialSchema1779199165939';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."group_invitations_status_enum" AS ENUM('pending', 'accepted', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tasks_status_enum" AS ENUM('todo', 'in_progress', 'pending_review', 'done', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_delivery_channel_enum" AS ENUM('web', 'email', 'both')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_preferred_language_enum" AS ENUM('en', 'vi')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."groups_status_enum" AS ENUM('active', 'locked')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cron_job_runs_status_enum" AS ENUM('running', 'success', 'failure')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cron_job_runs_triggered_by_enum" AS ENUM('cron', 'manual')`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role_name" character varying(50) NOT NULL, CONSTRAINT "UQ_roles_role_name" UNIQUE ("role_name"), CONSTRAINT "PK_roles" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `INSERT INTO "roles" ("role_name") VALUES ('user'), ('admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "group_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "group_id" uuid NOT NULL, "user_id" uuid NOT NULL, "is_active" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_f5939ee0ad233ad35e03f5c65c1" UNIQUE ("group_id", "user_id"), CONSTRAINT "PK_86446139b2c96bfd0f3b8638852" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7fbc70a7af2c156dd17fe6c685" ON "group_members" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_20a555b299f75843aa53ff8b0e" ON "group_members" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2c840df5db52dc6b4a1b0b69c6" ON "group_members" ("group_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "group_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "group_id" uuid NOT NULL, "invited_by_id" uuid NOT NULL, "email" character varying(255), "token" character varying(512) NOT NULL, "status" "public"."group_invitations_status_enum" NOT NULL DEFAULT 'pending', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_538592eba410862a9ab374462f9" UNIQUE ("token"), CONSTRAINT "PK_f7d0b290d6079ae9353d794227d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b1e45fcc9851ef9a9413da2ea4" ON "group_invitations" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_44c20845e1dd6a66ad4782199c" ON "group_invitations" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_871b36d9f354783c12379bdd52" ON "group_invitations" ("invited_by_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_312f24bd763f755ac2c1604083" ON "group_invitations" ("group_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "title" character varying(500) NOT NULL, "description" text, "group_id" uuid, "parent_task_id" uuid, "created_by_id" uuid NOT NULL, "assignee_id" uuid, "status" "public"."tasks_status_enum" NOT NULL DEFAULT 'todo', "due_date" TIMESTAMP WITH TIME ZONE, "submitted_at" TIMESTAMP WITH TIME ZONE, "reviewed_at" TIMESTAMP WITH TIME ZONE, "reviewed_by_id" uuid, CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_54fc42a253a8338488ec1f960a" ON "tasks" ("parent_task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_707cfc415c7c12d38dfc2ec8eb" ON "tasks" ("due_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6086c8dafbae729a930c04d865" ON "tasks" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_855d484825b715c545349212c7" ON "tasks" ("assignee_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0804c9432857e4d333583f5afe" ON "tasks" ("created_by_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_438e3c81c9f4209c1348366115" ON "tasks" ("group_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "contribution_ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "round_started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_round_closed" boolean NOT NULL DEFAULT false, "score" smallint, "due_date" TIMESTAMP WITH TIME ZONE NOT NULL, "group_id" uuid, "task_id" uuid, "rater_id" uuid, CONSTRAINT "UQ_5ec1997ddff2f74cf9a36a07569" UNIQUE ("task_id", "rater_id", "round_started_at"), CONSTRAINT "CHK_815c3fb7dc4d3c86765a63c26b" CHECK (("score" IS NULL) OR ("score" >= 0 AND "score" <= 10)), CONSTRAINT "PK_06c556a18f1a1154428e651f4ad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e571d8ad286b5a7437465c2cf9" ON "contribution_ratings" ("due_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e37efbcc52915d818d8b0b7463" ON "contribution_ratings" ("rater_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e16845e40a1655e4ef7f261f37" ON "contribution_ratings" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_649a61322b683ce5cf68d02c4f" ON "contribution_ratings" ("group_id", "rater_id", "round_started_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_24f35391055b329a7679b968d5" ON "contribution_ratings" ("group_id", "round_started_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "flashcards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "front" text NOT NULL, "back" text NOT NULL, "set_id" uuid, CONSTRAINT "PK_9acf891ec7aaa7ca05c264ea94d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3af6089335daaf47eabc3630ba" ON "flashcards" ("set_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "shared_group_flashcards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "set_id" uuid NOT NULL, "group_id" uuid NOT NULL, CONSTRAINT "UQ_5f6902732cb9322469286483226" UNIQUE ("set_id", "group_id"), CONSTRAINT "PK_e6b6be5e520d4b557228ffc5da2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_93d0c40b13fcd89e85a8f08fff" ON "shared_group_flashcards" ("group_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0849a6796166cdf793a922527c" ON "shared_group_flashcards" ("set_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "flashcard_study_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "set_id" uuid NOT NULL, "score" smallint NOT NULL, "next_review_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_a08f856af02410497c7d2da229" CHECK ("score" >= 0 AND "score" <= 100), CONSTRAINT "PK_2f61eb898811a1f3894391b602d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_df2bc6e588c89718e275ffe235" ON "flashcard_study_logs" ("next_review_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6c2610700a4771cea649eb5240" ON "flashcard_study_logs" ("set_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fc6832f43cba58e952c83f4009" ON "flashcard_study_logs" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "flashcard_sets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "owner_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "subject" character varying(255), "description" text, "card_count" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_70634f8cbb06202765aac894048" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_96de69f34477d11e8d620bcd53" ON "flashcard_sets" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ab4a59cdd2f7f1b65bb3ffcad2" ON "flashcard_sets" ("owner_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "recipient_id" uuid NOT NULL, "type" character varying(100) NOT NULL, "message" text NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "delivery_channel" "public"."notifications_delivery_channel_enum" NOT NULL DEFAULT 'web', "related_entity_type" character varying(255), "related_entity_id" uuid, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_77ee7b06d6f802000c0846f3a5" ON "notifications" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f12148ce379462ebbb4d06cc13" ON "notifications" ("is_read") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aef1c7aef3725068e5540f8f00" ON "notifications" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5332a4daa46fd3f4e6625dd275" ON "notifications" ("recipient_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(255) NOT NULL, "full_name" character varying(255) NOT NULL, "avatar_url" text, "role_id" uuid NOT NULL, "google_access_token" text, "google_refresh_token" text, "token_expires_at" TIMESTAMP WITH TIME ZONE, "drive_total_quota" bigint, "drive_used_quota" bigint, "quota_last_updated" TIMESTAMP WITH TIME ZONE, "is_active" boolean NOT NULL DEFAULT true, "notification_enabled" boolean NOT NULL DEFAULT true, "preferred_language" "public"."users_preferred_language_enum" NOT NULL DEFAULT 'vi', "last_login_at" TIMESTAMP WITH TIME ZONE, "canva_access_token" text, "canva_refresh_token" text, "canva_token_expires_at" TIMESTAMP WITH TIME ZONE, "refresh_token_version" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c9b5b525a96ddc2c5647d7f7fa" ON "users" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_20c7aea6112bef71528210f631" ON "users" ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ace513fa30d485cfd25c11a9e4" ON "users" ("role_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "description" text, "leader_id" uuid NOT NULL, "report_date" date, "tags" text array NOT NULL DEFAULT '{}', "status" "public"."groups_status_enum" NOT NULL DEFAULT 'active', "drive_folder_id" character varying(255), "canva_file_url" text, "canva_design_id" text, "doc_file_url" text, "meet_link" text, "google_calendar_id" character varying(512), CONSTRAINT "PK_659d1483316afb28afd3a90646e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2c77c18a08d4f88da652075f0a" ON "groups" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_479d3d96102ea6e80113503c68" ON "groups" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fdb67d577cb1623e0d11a3fa6b" ON "groups" ("leader_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "group_email_threads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "group_id" uuid NOT NULL, "user_id" uuid NOT NULL, "thread_message_id" character varying(512) NOT NULL, CONSTRAINT "UQ_e9b31a1a3a7f3ac41645781b5b3" UNIQUE ("group_id", "user_id"), CONSTRAINT "PK_a795b9256770fb3697bcdff4acd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_283584e85aa801869ab9545be5" ON "group_email_threads" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da245052e4b79588895be7d988" ON "group_email_threads" ("group_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "cron_job_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "job_name" character varying(128) NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "finished_at" TIMESTAMP WITH TIME ZONE, "status" "public"."cron_job_runs_status_enum" NOT NULL, "error_message" text, "triggered_by" "public"."cron_job_runs_triggered_by_enum" NOT NULL, CONSTRAINT "PK_78c377ed75735e17b98edf1bbc6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_38063cae1a13921fa514ffc089" ON "cron_job_runs" ("started_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6eff432603179fc4cc5ea56e89" ON "cron_job_runs" ("job_name") `,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_members" ADD CONSTRAINT "FK_2c840df5db52dc6b4a1b0b69c6e" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_members" ADD CONSTRAINT "FK_20a555b299f75843aa53ff8b0ee" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_invitations" ADD CONSTRAINT "FK_312f24bd763f755ac2c1604083c" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_invitations" ADD CONSTRAINT "FK_871b36d9f354783c12379bdd520" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_438e3c81c9f4209c13483661157" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_54fc42a253a8338488ec1f960ad" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_0804c9432857e4d333583f5afe1" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_855d484825b715c545349212c7f" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_fdc985e06843342a6357fd31f44" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "FK_39168a779a6659a040e917b4dd4" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "FK_e16845e40a1655e4ef7f261f37e" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" ADD CONSTRAINT "FK_e37efbcc52915d818d8b0b74637" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" ADD CONSTRAINT "FK_3af6089335daaf47eabc3630baa" FOREIGN KEY ("set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shared_group_flashcards" ADD CONSTRAINT "FK_0849a6796166cdf793a922527c3" FOREIGN KEY ("set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shared_group_flashcards" ADD CONSTRAINT "FK_93d0c40b13fcd89e85a8f08fff0" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_study_logs" ADD CONSTRAINT "FK_fc6832f43cba58e952c83f40091" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_study_logs" ADD CONSTRAINT "FK_6c2610700a4771cea649eb52409" FOREIGN KEY ("set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_sets" ADD CONSTRAINT "FK_ab4a59cdd2f7f1b65bb3ffcad2a" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_5332a4daa46fd3f4e6625dd275d" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "groups" ADD CONSTRAINT "FK_fdb67d577cb1623e0d11a3fa6b0" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_email_threads" ADD CONSTRAINT "FK_da245052e4b79588895be7d988e" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_email_threads" ADD CONSTRAINT "FK_283584e85aa801869ab9545be5c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "group_email_threads" DROP CONSTRAINT "FK_283584e85aa801869ab9545be5c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_email_threads" DROP CONSTRAINT "FK_da245052e4b79588895be7d988e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "groups" DROP CONSTRAINT "FK_fdb67d577cb1623e0d11a3fa6b0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_5332a4daa46fd3f4e6625dd275d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_sets" DROP CONSTRAINT "FK_ab4a59cdd2f7f1b65bb3ffcad2a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_study_logs" DROP CONSTRAINT "FK_6c2610700a4771cea649eb52409"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcard_study_logs" DROP CONSTRAINT "FK_fc6832f43cba58e952c83f40091"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shared_group_flashcards" DROP CONSTRAINT "FK_93d0c40b13fcd89e85a8f08fff0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shared_group_flashcards" DROP CONSTRAINT "FK_0849a6796166cdf793a922527c3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flashcards" DROP CONSTRAINT "FK_3af6089335daaf47eabc3630baa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT "FK_e37efbcc52915d818d8b0b74637"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT "FK_e16845e40a1655e4ef7f261f37e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contribution_ratings" DROP CONSTRAINT "FK_39168a779a6659a040e917b4dd4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_fdc985e06843342a6357fd31f44"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_855d484825b715c545349212c7f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_0804c9432857e4d333583f5afe1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_54fc42a253a8338488ec1f960ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_438e3c81c9f4209c13483661157"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_invitations" DROP CONSTRAINT "FK_871b36d9f354783c12379bdd520"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_invitations" DROP CONSTRAINT "FK_312f24bd763f755ac2c1604083c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_members" DROP CONSTRAINT "FK_20a555b299f75843aa53ff8b0ee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_members" DROP CONSTRAINT "FK_2c840df5db52dc6b4a1b0b69c6e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6eff432603179fc4cc5ea56e89"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_38063cae1a13921fa514ffc089"`,
    );
    await queryRunner.query(`DROP TABLE "cron_job_runs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_da245052e4b79588895be7d988"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_283584e85aa801869ab9545be5"`,
    );
    await queryRunner.query(`DROP TABLE "group_email_threads"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fdb67d577cb1623e0d11a3fa6b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_479d3d96102ea6e80113503c68"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2c77c18a08d4f88da652075f0a"`,
    );
    await queryRunner.query(`DROP TABLE "groups"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ace513fa30d485cfd25c11a9e4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_20c7aea6112bef71528210f631"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c9b5b525a96ddc2c5647d7f7fa"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5332a4daa46fd3f4e6625dd275"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aef1c7aef3725068e5540f8f00"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f12148ce379462ebbb4d06cc13"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_77ee7b06d6f802000c0846f3a5"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ab4a59cdd2f7f1b65bb3ffcad2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_96de69f34477d11e8d620bcd53"`,
    );
    await queryRunner.query(`DROP TABLE "flashcard_sets"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fc6832f43cba58e952c83f4009"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6c2610700a4771cea649eb5240"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_df2bc6e588c89718e275ffe235"`,
    );
    await queryRunner.query(`DROP TABLE "flashcard_study_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0849a6796166cdf793a922527c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_93d0c40b13fcd89e85a8f08fff"`,
    );
    await queryRunner.query(`DROP TABLE "shared_group_flashcards"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3af6089335daaf47eabc3630ba"`,
    );
    await queryRunner.query(`DROP TABLE "flashcards"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_24f35391055b329a7679b968d5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_649a61322b683ce5cf68d02c4f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e16845e40a1655e4ef7f261f37"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e37efbcc52915d818d8b0b7463"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e571d8ad286b5a7437465c2cf9"`,
    );
    await queryRunner.query(`DROP TABLE "contribution_ratings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_438e3c81c9f4209c1348366115"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0804c9432857e4d333583f5afe"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_855d484825b715c545349212c7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6086c8dafbae729a930c04d865"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_707cfc415c7c12d38dfc2ec8eb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_54fc42a253a8338488ec1f960a"`,
    );
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_312f24bd763f755ac2c1604083"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_871b36d9f354783c12379bdd52"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_44c20845e1dd6a66ad4782199c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b1e45fcc9851ef9a9413da2ea4"`,
    );
    await queryRunner.query(`DROP TABLE "group_invitations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2c840df5db52dc6b4a1b0b69c6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_20a555b299f75843aa53ff8b0e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7fbc70a7af2c156dd17fe6c685"`,
    );
    await queryRunner.query(`DROP TABLE "group_members"`);
    await queryRunner.query(
      `DROP TYPE "public"."group_invitations_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."tasks_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."notifications_delivery_channel_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."users_preferred_language_enum"`);
    await queryRunner.query(`DROP TYPE "public"."groups_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."cron_job_runs_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."cron_job_runs_triggered_by_enum"`,
    );
  }
}
