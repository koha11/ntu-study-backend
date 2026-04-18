import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupInvitation } from '../groups/entities/group-invitation.entity';
import { User } from '@modules/users/entities/user.entity';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(GroupInvitation)
    private invitationsRepository: Repository<GroupInvitation>,
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  async createInvitation(
    _invitationData: Partial<GroupInvitation>,
  ): Promise<GroupInvitation> {
    // TODO: Create invitation token
    throw new Error('Not implemented');
  }

  async acceptInvitation(_token: string): Promise<User> {
    // TODO: Accept invitation and create/link user
    throw new Error('Not implemented');
  }

  async validateInvitationToken(_token: string): Promise<GroupInvitation> {
    // TODO: Validate invitation token (not expired, not already accepted)
    throw new Error('Not implemented');
  }

  async findGroupInvitations(_groupId: string): Promise<GroupInvitation[]> {
    // TODO: Find all invitations for group
    return [];
  }
}
