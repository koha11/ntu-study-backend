import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './services/email.service';
import { GoogleDriveService } from './services/google-drive.service';
import { TaskSchedulerService } from './services/task-scheduler.service';
import { Task } from '../modules/tasks/entities/task.entity';
import { User } from '../modules/users/entities/user.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Task, User, Notification])],
  providers: [EmailService, GoogleDriveService, TaskSchedulerService],
  exports: [EmailService, GoogleDriveService, TaskSchedulerService],
})
export class CommonModule {}
