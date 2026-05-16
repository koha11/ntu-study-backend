import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { UsersModule } from '@modules/users/users.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { TasksModule } from '@modules/tasks/tasks.module';
import { CommonModule } from '@common/common.module';
import { AuthModule } from '@modules/auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, GroupMember]),
    UsersModule,
    NotificationsModule,
    TasksModule,
    CommonModule,
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
