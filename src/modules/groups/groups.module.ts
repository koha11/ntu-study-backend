import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { GroupInvitation } from './entities/group-invitation.entity';
import { UsersModule } from '@modules/users/users.module';
import { CommonModule } from '@common/common.module';
import { InvitationsModule } from '@modules/invitations/invitations.module';
import { AuthModule } from '@modules/auth/auth.module';
import { CanvaModule } from '@modules/canva/canva.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, GroupMember, GroupInvitation]),
    UsersModule,
    CommonModule,
    InvitationsModule,
    AuthModule,
    CanvaModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
