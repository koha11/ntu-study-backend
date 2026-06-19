import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';
import { TaskOutcomeLink } from './entities/task-outcome-link.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { UsersModule } from '@modules/users/users.module';
import { CommonModule } from '@common/common.module';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskOutcomeLink, GroupMember, Group]),
    NotificationsModule,
    UsersModule,
    CommonModule,
    AuthModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
