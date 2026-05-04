import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './services/email.service';
import { GoogleDriveService } from './services/google-drive.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { TaskSchedulerService } from './services/task-scheduler.service';
import { Task } from '../modules/tasks/entities/task.entity';
import { User } from '../modules/users/entities/user.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { CronJobRun } from '../modules/cron-jobs/entities/cron-job-run.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Task, User, Notification, CronJobRun])],
  providers: [
    EmailService,
    GoogleDriveService,
    GoogleCalendarService,
    TaskSchedulerService,
  ],
  exports: [
    EmailService,
    GoogleDriveService,
    GoogleCalendarService,
    TaskSchedulerService,
  ],
})
export class CommonModule {}
