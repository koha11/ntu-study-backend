import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { UsersModule } from '@modules/users/users.module';
import { CommonModule } from '@common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, GroupMember, Group]),
    NotificationsModule,
    UsersModule,
    CommonModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
