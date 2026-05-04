import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User } from '@modules/users/entities/user.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { Task } from '@modules/tasks/entities/task.entity';
import { CronJobRun } from '@modules/cron-jobs/entities/cron-job-run.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { CommonModule } from '@common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Group, GroupMember, Task, CronJobRun]),
    AuthModule,
    CommonModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
