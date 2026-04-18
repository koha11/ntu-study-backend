import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AppConfigModule } from './config/config.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GroupsModule } from './modules/groups/groups.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { FlashcardsModule } from './modules/flashcards/flashcards.module';
import { ContributionsModule } from './modules/contributions/contributions.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { GoogleDriveModule } from './modules/google-drive/google-drive.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    CommonModule,
    HealthModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    InvitationsModule,
    TasksModule,
    FlashcardsModule,
    ContributionsModule,
    AuditLogsModule,
    NotificationsModule,
    GoogleDriveModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
