import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { GroupInvitation } from '@modules/groups/entities/group-invitation.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { User } from '@modules/users/entities/user.entity';
import { UsersModule } from '@modules/users/users.module';
import { CommonModule } from '@common/common.module';
import { AuthModule } from '@modules/auth/auth.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupInvitation, User, Group, GroupMember]),
    UsersModule,
    CommonModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
