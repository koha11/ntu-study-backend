import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { GroupInvitation } from '@modules/groups/entities/group-invitation.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { User } from '@modules/users/entities/user.entity';
import { UsersService } from '@modules/users/users.service';
import { EmailService } from '@common/services/email.service';
import { GoogleDriveService } from '@common/services/google-drive.service';
import { GoogleAccessTokenService } from '@modules/auth/services/google-access-token.service';
import { InvitationStatus } from '@common/enums';
import { NotificationsService } from '@modules/notifications/notifications.service';
import {
  NOTIFICATION_TYPE,
  RELATED_ENTITY_TYPE,
} from '@common/constants/notification-types';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  return randomBytes(24).toString('hex');
}

export interface CreateInvitationParams {
  groupId: string;
  invitedByUserId: string;
  email: string;
}

export interface ValidateInvitationResult {
  valid: boolean;
  invitation?: GroupInvitation;
  reason?: string;
}

export interface ResendGroupInvitationParams {
  groupId: string;
  invitationId: string;
  leaderUserId: string;
}

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(GroupInvitation)
    private readonly invitationsRepository: Repository<GroupInvitation>,
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly membersRepository: Repository<GroupMember>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly googleDriveService: GoogleDriveService,
    private readonly googleAccessTokenService: GoogleAccessTokenService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createInvitation(
    params: CreateInvitationParams,
  ): Promise<GroupInvitation> {
    const { saved, group, existingInviteeId } =
      await this.insertInvitationRecord(
        this.invitationsRepository.manager,
        params,
      );
    const normalized = params.email.trim().toLowerCase();
    await this.sendInvitationEmail(saved, group, normalized);
    if (existingInviteeId) {
      await this.notifyExistingUserOfInvitation(
        saved,
        group,
        existingInviteeId,
      );
    }
    return saved;
  }

  /**
   * Persists a new pending invitation (validation + insert). Does not send email.
   */
  private async insertInvitationRecord(
    manager: EntityManager,
    params: CreateInvitationParams,
  ): Promise<{
    saved: GroupInvitation;
    group: Group;
    existingInviteeId?: string;
  }> {
    const { groupId, invitedByUserId, email } = params;
    const normalized = email.trim().toLowerCase();

    const invRepo = manager.getRepository(GroupInvitation);
    const grpRepo = manager.getRepository(Group);
    const memRepo = manager.getRepository(GroupMember);

    const group = await grpRepo.findOne({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    if (group.leader_id !== invitedByUserId) {
      throw new ForbiddenException('Only the group leader can invite members');
    }

    let existingInviteeId: string | undefined;
    const existingUser = await this.usersService.findByEmail(normalized);
    if (existingUser) {
      const alreadyMember = await memRepo.findOne({
        where: { group_id: groupId, user_id: existingUser.id },
      });
      if (alreadyMember) {
        throw new ConflictException('User is already a member of this group');
      }
      existingInviteeId = existingUser.id;
    }

    const duplicatePending = await invRepo.findOne({
      where: {
        group_id: groupId,
        email: normalized,
        status: InvitationStatus.PENDING,
      },
    });
    if (duplicatePending) {
      throw new ConflictException(
        'A pending invitation already exists for this email',
      );
    }

    let token = generateToken();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await invRepo.findOne({
        where: { token },
      });
      if (!clash) break;
      token = generateToken();
    }

    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitation = invRepo.create({
      group_id: groupId,
      invited_by_id: invitedByUserId,
      email: normalized,
      token,
      status: InvitationStatus.PENDING,
      expires_at: expiresAt,
    });
    const saved = await invRepo.save(invitation);

    return { saved, group, existingInviteeId };
  }

  private async notifyExistingUserOfInvitation(
    saved: GroupInvitation,
    group: Group,
    inviteeId: string,
  ): Promise<void> {
    const inviter = await this.usersService.findOne(saved.invited_by_id);
    const inviterName = inviter?.full_name ?? 'Someone';
    await this.notificationsService.createNotification({
      recipient_id: inviteeId,
      type: NOTIFICATION_TYPE.GROUP_INVITATION,
      message: `${inviterName} invited you to join ${group.name}`,
      related_entity_type: RELATED_ENTITY_TYPE.GROUP_INVITATION,
      related_entity_id: saved.id,
    });
  }

  private async sendInvitationEmail(
    saved: GroupInvitation,
    group: Group,
    normalizedEmail: string,
  ): Promise<void> {
    const inviter = await this.usersService.findOne(saved.invited_by_id);
    const baseUrl =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ||
      'http://localhost:5173';
    const invitationLink = `${baseUrl}/invitations/${saved.token}/accept`;

    if (inviter) {
      await this.emailService.sendGroupInvitation(
        normalizedEmail,
        inviter.full_name,
        group.name,
        invitationLink,
      );
    }
  }

  async resendGroupInvitation(
    params: ResendGroupInvitationParams,
  ): Promise<GroupInvitation> {
    const { groupId, invitationId, leaderUserId } = params;

    const { saved, group, existingInviteeId } =
      await this.dataSource.transaction(
        async (
          manager,
        ): Promise<{
          saved: GroupInvitation;
          group: Group;
          existingInviteeId?: string;
        }> => {
          const invRepo = manager.getRepository(GroupInvitation);
          const invitation = await invRepo.findOne({
            where: { id: invitationId, group_id: groupId },
          });
          if (!invitation) {
            throw new NotFoundException('Invitation not found');
          }

          const grpRepo = manager.getRepository(Group);
          const groupRow = await grpRepo.findOne({ where: { id: groupId } });
          if (!groupRow) {
            throw new NotFoundException('Group not found');
          }
          if (groupRow.leader_id !== leaderUserId) {
            throw new ForbiddenException(
              'Only the group leader can resend invitations',
            );
          }

          if (invitation.status === InvitationStatus.ACCEPTED) {
            throw new ConflictException('Invitation already accepted');
          }

          const emailNorm = invitation.email?.trim().toLowerCase();
          if (!emailNorm) {
            throw new BadRequestException('Invitation has no email');
          }

          if (invitation.status === InvitationStatus.PENDING) {
            invitation.status = InvitationStatus.EXPIRED;
            await invRepo.save(invitation);
          } else if (invitation.status !== InvitationStatus.EXPIRED) {
            throw new BadRequestException('Invitation cannot be resent');
          }

          return this.insertInvitationRecord(manager, {
            groupId,
            invitedByUserId: leaderUserId,
            email: emailNorm,
          });
        },
      );

    const normalized = saved.email?.trim().toLowerCase() ?? '';
    await this.sendInvitationEmail(saved, group, normalized);
    if (existingInviteeId) {
      await this.notifyExistingUserOfInvitation(
        saved,
        group,
        existingInviteeId,
      );
    }
    return saved;
  }

  async validateInvitationToken(
    token: string,
  ): Promise<ValidateInvitationResult> {
    const invitation = await this.invitationsRepository.findOne({
      where: { token },
      relations: ['group'],
    });
    if (!invitation) {
      return { valid: false, reason: 'not_found' };
    }
    if (invitation.status === InvitationStatus.ACCEPTED) {
      return {
        valid: false,
        reason: 'already_accepted',
        invitation,
      };
    }
    const now = new Date();
    if (invitation.expires_at < now) {
      if (invitation.status === InvitationStatus.PENDING) {
        invitation.status = InvitationStatus.EXPIRED;
        await this.invitationsRepository.save(invitation);
      }
      return { valid: false, reason: 'expired', invitation };
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      return { valid: false, reason: 'invalid_status', invitation };
    }
    return { valid: true, invitation };
  }

  async acceptInvitation(
    token: string,
    body?: { full_name?: string },
  ): Promise<{ user: User }> {
    const invitation = await this.invitationsRepository.findOne({
      where: { token },
      relations: ['group'],
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException('Invitation already accepted');
    }
    const now = new Date();
    if (invitation.expires_at < now) {
      if (invitation.status === InvitationStatus.PENDING) {
        invitation.status = InvitationStatus.EXPIRED;
        await this.invitationsRepository.save(invitation);
      }
      throw new BadRequestException('Invitation has expired');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer valid');
    }

    const email = invitation.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Invitation has no email');
    }

    let user = await this.usersService.findByEmail(email);
    if (!user) {
      const fullName =
        body?.full_name?.trim() ||
        email
          .split('@')[0]
          .replace(/[._]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      user = await this.usersService.create({
        email,
        full_name: fullName,
        is_active: true,
        notification_enabled: true,
      });
    }

    const existingMember = await this.membersRepository.findOne({
      where: { group_id: invitation.group_id, user_id: user.id },
    });
    if (existingMember) {
      throw new ConflictException('Already a member of this group');
    }

    const folderId = invitation.group?.drive_folder_id?.trim();
    if (folderId) {
      const leader = await this.usersService.findById(
        invitation.group.leader_id,
        true,
      );
      if (!leader) {
        throw new BadRequestException('Group leader not found');
      }
      const accessToken =
        await this.googleAccessTokenService.resolveGoogleAccessToken(leader);
      if (!accessToken) {
        throw new BadRequestException(
          'Cannot complete invitation: the group leader must reconnect Google so the Drive folder can be shared.',
        );
      }
      const shareResult: unknown = await this.googleDriveService.shareFile(
        accessToken,
        folderId,
        email,
        'writer',
      );
      if (!shareResult) {
        throw new BadRequestException(
          'Could not share the group Drive folder with this email. Try again or contact the group leader.',
        );
      }
    }

    const member = this.membersRepository.create({
      group_id: invitation.group_id,
      user_id: user.id,
      is_active: true,
    });
    await this.membersRepository.save(member);

    invitation.status = InvitationStatus.ACCEPTED;
    await this.invitationsRepository.save(invitation);

    return { user };
  }

  /**
   * Lets an authenticated user resolve an invitation token from its id (e.g. from an in-app notification).
   * Only allowed when the invitation email matches the user and status is pending and not expired.
   */
  async getPendingInvitationTokenForRecipient(
    invitationId: string,
    userId: string,
  ): Promise<{ token: string }> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const emailNorm = invitation.email?.trim().toLowerCase();
    const userEmail = user.email.trim().toLowerCase();
    if (!emailNorm || emailNorm !== userEmail) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is no longer pending');
    }

    const now = new Date();
    if (invitation.expires_at < now) {
      throw new BadRequestException('Invitation has expired');
    }

    return { token: invitation.token };
  }

  async findGroupInvitationsForLeader(
    groupId: string,
    userId: string,
  ): Promise<GroupInvitation[]> {
    const group = await this.groupsRepository.findOne({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    if (group.leader_id !== userId) {
      throw new ForbiddenException(
        'Only the group leader can list invitations',
      );
    }
    return this.invitationsRepository.find({
      where: { group_id: groupId },
      order: { created_at: 'DESC' },
    });
  }
}
