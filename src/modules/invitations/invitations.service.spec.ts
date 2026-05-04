import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvitationsService } from './invitations.service';
import { GroupInvitation } from '@modules/groups/entities/group-invitation.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { User } from '@modules/users/entities/user.entity';
import { UsersService } from '@modules/users/users.service';
import { EmailService } from '@common/services/email.service';
import { GoogleDriveService } from '@common/services/google-drive.service';
import { GoogleAccessTokenService } from '@modules/auth/services/google-access-token.service';
import { DataSource } from 'typeorm';
import { InvitationStatus, UserRole } from '@common/enums';
import { NOTIFICATION_TYPE, RELATED_ENTITY_TYPE } from '@common/constants/notification-types';
import { NotificationsService } from '@modules/notifications/notifications.service';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let invitationsRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    manager: { getRepository: (e: unknown) => unknown };
  };
  let groupsRepository: { findOne: ReturnType<typeof vi.fn> };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let membersRepository: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let emailService: { sendGroupInvitation: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let googleDriveService: { shareFile: ReturnType<typeof vi.fn> };
  let googleAccessTokenService: {
    resolveGoogleAccessToken: ReturnType<typeof vi.fn>;
  };
  let notificationsService: { createNotification: ReturnType<typeof vi.fn> };

  const groupId = 'gggggggg-gggg-gggg-gggg-gggggggggggg';
  const leaderId = 'llllllll-llll-llll-llll-llllllllllll';
  const email = 'invitee@test.com';
  const invitationId = 'iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii';

  const inviter: Partial<User> = {
    id: leaderId,
    full_name: 'Leader',
    email: 'lead@test.com',
  };

  const group: Partial<Group> = {
    id: groupId,
    name: 'G1',
    leader_id: leaderId,
  };

  beforeEach(async () => {
    groupsRepository = {
      findOne: vi.fn(),
    };

    membersRepository = {
      findOne: vi.fn(),
      create: vi.fn((x: Partial<GroupMember>) => x),
      save: vi.fn((x: Partial<GroupMember>) => Promise.resolve(x)),
    };

    const managerGetRepository = (entity: unknown) => {
      if (entity === GroupInvitation) return invitationsRepository;
      if (entity === Group) return groupsRepository;
      if (entity === GroupMember) return membersRepository;
      throw new Error('unexpected entity in manager.getRepository');
    };

    invitationsRepository = {
      create: vi.fn((x: Partial<GroupInvitation>) => x),
      save: vi.fn((inv: Partial<GroupInvitation>) =>
        Promise.resolve({
          id: 'inv-id',
          ...inv,
          created_at: new Date(),
          updated_at: new Date(),
        }),
      ),
      findOne: vi.fn(),
      find: vi.fn(),
      manager: { getRepository: managerGetRepository },
    };

    usersService = {
      findByEmail: vi.fn(),
      findOne: vi.fn().mockResolvedValue(inviter as User),
      findById: vi.fn(),
      create: vi.fn(),
    };

    emailService = {
      sendGroupInvitation: vi.fn().mockResolvedValue(true),
    };

    configService = {
      get: vi.fn().mockReturnValue('http://frontend.test'),
    };

    googleDriveService = {
      shareFile: vi.fn(),
    };

    googleAccessTokenService = {
      resolveGoogleAccessToken: vi.fn(),
    };

    notificationsService = {
      createNotification: vi.fn().mockResolvedValue({}),
    };

    dataSource = {
      transaction: vi.fn(
        <T,>(fn: (m: { getRepository: typeof managerGetRepository }) => Promise<T>) =>
          fn({ getRepository: managerGetRepository } as never),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        {
          provide: getRepositoryToken(GroupInvitation),
          useValue: invitationsRepository,
        },
        { provide: getRepositoryToken(Group), useValue: groupsRepository },
        {
          provide: getRepositoryToken(GroupMember),
          useValue: membersRepository,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: UsersService, useValue: usersService },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: configService },
        { provide: GoogleDriveService, useValue: googleDriveService },
        {
          provide: GoogleAccessTokenService,
          useValue: googleAccessTokenService,
        },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(InvitationsService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('createInvitation', () => {
    it('assigns unique token and expiry', async () => {
      groupsRepository.findOne.mockResolvedValue(group as Group);
      usersService.findByEmail.mockResolvedValue(null);
      invitationsRepository.findOne.mockResolvedValue(null);

      const inv = await service.createInvitation({
        groupId,
        invitedByUserId: leaderId,
        email,
      });

      expect(inv.token).toBeTruthy();
      expect(inv.expires_at.getTime()).toBeGreaterThan(Date.now());
      expect(inv.status).toBe(InvitationStatus.PENDING);
    });

    it('throws when duplicate pending invitation exists', async () => {
      groupsRepository.findOne.mockResolvedValue(group as Group);
      usersService.findByEmail.mockResolvedValue(null);
      invitationsRepository.findOne.mockResolvedValue({ id: 'dup' });

      await expect(
        service.createInvitation({
          groupId,
          invitedByUserId: leaderId,
          email,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws when inviter is not leader', async () => {
      groupsRepository.findOne.mockResolvedValue(group as Group);

      await expect(
        service.createInvitation({
          groupId,
          invitedByUserId: 'not-leader',
          email,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates in-app notification when invitee is an existing user', async () => {
      const existingInvitee = {
        id: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
        email,
      };
      groupsRepository.findOne.mockResolvedValue(group as Group);
      usersService.findByEmail.mockResolvedValue(existingInvitee as User);
      membersRepository.findOne.mockResolvedValue(null);
      invitationsRepository.findOne.mockResolvedValue(null);

      const inv = await service.createInvitation({
        groupId,
        invitedByUserId: leaderId,
        email,
      });

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_id: existingInvitee.id,
          type: NOTIFICATION_TYPE.GROUP_INVITATION,
          related_entity_type: RELATED_ENTITY_TYPE.GROUP_INVITATION,
          related_entity_id: inv.id,
        }),
      );
    });

    it('does not create in-app notification when email is not registered', async () => {
      groupsRepository.findOne.mockResolvedValue(group as Group);
      usersService.findByEmail.mockResolvedValue(null);
      invitationsRepository.findOne.mockResolvedValue(null);

      await service.createInvitation({
        groupId,
        invitedByUserId: leaderId,
        email,
      });

      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('getPendingInvitationTokenForRecipient', () => {
    it('returns token when invitation email matches user and is pending', async () => {
      const inviteeId = 'iu-iuiu-iuiu-iuiu-iuiuiuiuiuiu';
      usersService.findOne.mockResolvedValue({
        id: inviteeId,
        email,
      } as User);
      invitationsRepository.findOne.mockResolvedValue({
        id: invitationId,
        email,
        token: 'hex-token',
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
      } as GroupInvitation);

      const result = await service.getPendingInvitationTokenForRecipient(
        invitationId,
        inviteeId,
      );

      expect(result).toEqual({ token: 'hex-token' });
    });

    it('throws NotFound when invitation email does not match user', async () => {
      usersService.findOne.mockResolvedValue({
        id: leaderId,
        email: 'someone@else.com',
      } as User);
      invitationsRepository.findOne.mockResolvedValue({
        id: invitationId,
        email,
        token: 't',
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
      } as GroupInvitation);

      await expect(
        service.getPendingInvitationTokenForRecipient(invitationId, leaderId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateInvitationToken', () => {
    it('returns valid true for pending non-expired token', async () => {
      const invitation: Partial<GroupInvitation> = {
        token: 't1',
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
        group: group as Group,
      };
      invitationsRepository.findOne.mockResolvedValue(
        invitation as GroupInvitation,
      );

      const result = await service.validateInvitationToken('t1');

      expect(result.valid).toBe(true);
      expect(result.invitation?.token).toBe('t1');
    });

    it('marks invitation expired when past expires_at', async () => {
      const invitation: Partial<GroupInvitation> = {
        token: 't2',
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() - 1000),
      };
      invitationsRepository.findOne.mockResolvedValue(
        invitation as GroupInvitation,
      );

      const result = await service.validateInvitationToken('t2');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
      expect(invitationsRepository.save).toHaveBeenCalled();
    });
  });

  describe('acceptInvitation', () => {
    it('creates membership and marks accepted for existing user', async () => {
      const user: Partial<User> = {
        id: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
        email,
        full_name: 'Invitee',
        role: UserRole.USER,
        is_active: true,
        notification_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const invitation: Partial<GroupInvitation> = {
        token: 'acc',
        group_id: groupId,
        email,
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
        group: group as Group,
      };

      invitationsRepository.findOne.mockResolvedValue(
        invitation as GroupInvitation,
      );
      usersService.findByEmail.mockResolvedValue(user as User);
      membersRepository.findOne.mockResolvedValue(null);

      const result = await service.acceptInvitation('acc', {});

      expect(result.user.id).toBe(user.id);
      expect(membersRepository.save).toHaveBeenCalled();
      expect(invitationsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.ACCEPTED }),
      );
      expect(googleDriveService.shareFile).not.toHaveBeenCalled();
    });

    it('shares group Drive folder as writer before saving member when folder linked', async () => {
      const user: Partial<User> = {
        id: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
        email,
        full_name: 'Invitee',
        role: UserRole.USER,
        is_active: true,
        notification_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const groupWithDrive: Partial<Group> = {
        ...group,
        drive_folder_id: 'drive-folder-id',
      };
      const invitation: Partial<GroupInvitation> = {
        token: 'acc-drive',
        group_id: groupId,
        email,
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
        group: groupWithDrive as Group,
      };

      invitationsRepository.findOne.mockResolvedValue(
        invitation as GroupInvitation,
      );
      usersService.findByEmail.mockResolvedValue(user as User);
      membersRepository.findOne.mockResolvedValue(null);
      usersService.findById.mockResolvedValue(inviter as User);
      googleAccessTokenService.resolveGoogleAccessToken.mockResolvedValue(
        'leader-token',
      );
      googleDriveService.shareFile.mockResolvedValue({ id: 'perm-1' });

      const result = await service.acceptInvitation('acc-drive', {});

      expect(result.user.id).toBe(user.id);
      expect(usersService.findById).toHaveBeenCalledWith(leaderId, true);
      expect(googleDriveService.shareFile).toHaveBeenCalledWith(
        'leader-token',
        'drive-folder-id',
        email,
        'writer',
      );
      expect(membersRepository.save).toHaveBeenCalled();
      expect(invitationsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.ACCEPTED }),
      );
    });

    it('throws when Drive share returns null and does not persist membership', async () => {
      const user: Partial<User> = {
        id: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
        email,
        full_name: 'Invitee',
        role: UserRole.USER,
        is_active: true,
        notification_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const groupWithDrive: Partial<Group> = {
        ...group,
        drive_folder_id: 'drive-folder-id',
      };
      const invitation: Partial<GroupInvitation> = {
        token: 'acc-fail',
        group_id: groupId,
        email,
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
        group: groupWithDrive as Group,
      };

      invitationsRepository.findOne.mockResolvedValue(
        invitation as GroupInvitation,
      );
      usersService.findByEmail.mockResolvedValue(user as User);
      membersRepository.findOne.mockResolvedValue(null);
      usersService.findById.mockResolvedValue(inviter as User);
      googleAccessTokenService.resolveGoogleAccessToken.mockResolvedValue(
        'leader-token',
      );
      googleDriveService.shareFile.mockResolvedValue(null);

      await expect(service.acceptInvitation('acc-fail', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(membersRepository.save).not.toHaveBeenCalled();
      expect(invitationsRepository.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.ACCEPTED }),
      );
    });

    it('throws when leader has no Google access token for sharing', async () => {
      const user: Partial<User> = {
        id: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
        email,
        full_name: 'Invitee',
        role: UserRole.USER,
        is_active: true,
        notification_enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const groupWithDrive: Partial<Group> = {
        ...group,
        drive_folder_id: 'drive-folder-id',
      };
      const invitation: Partial<GroupInvitation> = {
        token: 'acc-no-tok',
        group_id: groupId,
        email,
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
        group: groupWithDrive as Group,
      };

      invitationsRepository.findOne.mockResolvedValue(
        invitation as GroupInvitation,
      );
      usersService.findByEmail.mockResolvedValue(user as User);
      membersRepository.findOne.mockResolvedValue(null);
      usersService.findById.mockResolvedValue(inviter as User);
      googleAccessTokenService.resolveGoogleAccessToken.mockResolvedValue(null);

      await expect(service.acceptInvitation('acc-no-tok', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(googleDriveService.shareFile).not.toHaveBeenCalled();
      expect(membersRepository.save).not.toHaveBeenCalled();
    });

    it('auto-registers user when email not found', async () => {
      const invitation: Partial<GroupInvitation> = {
        token: 'new',
        group_id: groupId,
        email,
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
        group: group as Group,
      };
      const created: Partial<User> = {
        id: 'new-u',
        email,
        full_name: 'Invitee Test',
      };

      invitationsRepository.findOne.mockResolvedValue(
        invitation as GroupInvitation,
      );
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(created as User);
      membersRepository.findOne.mockResolvedValue(null);

      await service.acceptInvitation('new', { full_name: 'Invitee Test' });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          full_name: 'Invitee Test',
        }),
      );
    });
  });

  describe('resendGroupInvitation', () => {
    function stubInvitationLookup(existing: Partial<GroupInvitation>) {
      invitationsRepository.findOne.mockImplementation(async (opts: { where?: Record<string, unknown> }) => {
        const w = opts?.where ?? {};
        if (w.id === invitationId && w.group_id === groupId) {
          return existing as GroupInvitation;
        }
        if (
          w.group_id === groupId &&
          w.email === email &&
          w.status === InvitationStatus.PENDING
        ) {
          return null;
        }
        if (typeof w.token === 'string') {
          return null;
        }
        return null;
      });
    }

    it('expires pending invitation and creates a new pending invitation', async () => {
      const pendingInv: Partial<GroupInvitation> = {
        id: invitationId,
        group_id: groupId,
        email,
        status: InvitationStatus.PENDING,
        token: 'oldtok',
        expires_at: new Date(Date.now() + 86400000),
      };
      stubInvitationLookup(pendingInv);
      groupsRepository.findOne.mockResolvedValue(group as Group);
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.resendGroupInvitation({
        groupId,
        invitationId,
        leaderUserId: leaderId,
      });

      expect(result.status).toBe(InvitationStatus.PENDING);
      expect(result.email).toBe(email.toLowerCase());
      expect(invitationsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: invitationId,
          status: InvitationStatus.EXPIRED,
        }),
      );
      expect(emailService.sendGroupInvitation).toHaveBeenCalled();
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('creates new invitation when existing row is expired without extra expire save shape', async () => {
      const expiredInv: Partial<GroupInvitation> = {
        id: invitationId,
        group_id: groupId,
        email,
        status: InvitationStatus.EXPIRED,
        token: 'old',
        expires_at: new Date(Date.now() - 1000),
      };
      stubInvitationLookup(expiredInv);
      groupsRepository.findOne.mockResolvedValue(group as Group);
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.resendGroupInvitation({
        groupId,
        invitationId,
        leaderUserId: leaderId,
      });

      expect(result.status).toBe(InvitationStatus.PENDING);
      expect(invitationsRepository.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: invitationId, status: InvitationStatus.EXPIRED }),
      );
      expect(emailService.sendGroupInvitation).toHaveBeenCalled();
    });

    it('throws ConflictException when invitation was already accepted', async () => {
      const acceptedInv: Partial<GroupInvitation> = {
        id: invitationId,
        group_id: groupId,
        email,
        status: InvitationStatus.ACCEPTED,
        token: 't',
        expires_at: new Date(),
      };
      stubInvitationLookup(acceptedInv);
      groupsRepository.findOne.mockResolvedValue(group as Group);

      await expect(
        service.resendGroupInvitation({
          groupId,
          invitationId,
          leaderUserId: leaderId,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFound when invitation is missing for group', async () => {
      invitationsRepository.findOne.mockResolvedValue(null);
      groupsRepository.findOne.mockResolvedValue(group as Group);

      await expect(
        service.resendGroupInvitation({
          groupId,
          invitationId,
          leaderUserId: leaderId,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws Forbidden when user is not the group leader', async () => {
      const pendingInv: Partial<GroupInvitation> = {
        id: invitationId,
        group_id: groupId,
        email,
        status: InvitationStatus.PENDING,
        token: 't',
        expires_at: new Date(Date.now() + 86400000),
      };
      stubInvitationLookup(pendingInv);
      groupsRepository.findOne.mockResolvedValue(group as Group);

      await expect(
        service.resendGroupInvitation({
          groupId,
          invitationId,
          leaderUserId: 'not-the-leader-uuid-0000-0000-0000-000000000000',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequest when invitation has no email', async () => {
      const noEmail: Partial<GroupInvitation> = {
        id: invitationId,
        group_id: groupId,
        email: undefined,
        status: InvitationStatus.PENDING,
        token: 't',
        expires_at: new Date(Date.now() + 86400000),
      };
      stubInvitationLookup(noEmail);
      groupsRepository.findOne.mockResolvedValue(group as Group);

      await expect(
        service.resendGroupInvitation({
          groupId,
          invitationId,
          leaderUserId: leaderId,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findGroupInvitationsForLeader', () => {
    it('throws when requester is not leader', async () => {
      groupsRepository.findOne.mockResolvedValue(group as Group);

      await expect(
        service.findGroupInvitationsForLeader(groupId, 'not-leader'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws when group missing', async () => {
      groupsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findGroupInvitationsForLeader(groupId, leaderId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
