import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { UsersService } from '@modules/users/users.service';
import { GoogleDriveService } from '@common/services/google-drive.service';
import { GoogleCalendarService } from '@common/services/google-calendar.service';
import { GoogleAccessTokenService } from '@modules/auth/services/google-access-token.service';
import { InvitationsService } from '@modules/invitations/invitations.service';
import { CanvaService } from '@modules/canva/canva.service';
import { GroupStatus } from '@common/enums';
import { User } from '@modules/users/entities/user.entity';
import { UserRole, InvitationStatus } from '@common/enums';
import { GroupInvitation } from './entities/group-invitation.entity';

describe('GroupsService', () => {
  let service: GroupsService;
  let groupsRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let membersRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let googleDriveService: { createFolder: ReturnType<typeof vi.fn> };
  let canvaService: { createPresentation: ReturnType<typeof vi.fn> };
  let invitationsService: {
    createInvitation: ReturnType<typeof vi.fn>;
  };
  let googleCalendarService: {
    createEventWithMeetLink: ReturnType<typeof vi.fn>;
    listEventsInRange: ReturnType<typeof vi.fn>;
    createGroupCalendarEvent: ReturnType<typeof vi.fn>;
  };
  let googleAccessTokenService: {
    resolveGoogleAccessToken: ReturnType<typeof vi.fn>;
  };

  const leaderId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const groupId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const mockLeader: Partial<User> = {
    id: leaderId,
    email: 'leader@test.com',
    full_name: 'Leader',
    role: UserRole.USER,
    google_access_token: 'g-token',
    is_active: true,
    notification_enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    groupsRepository = {
      create: vi.fn((dto: Partial<Group>) => dto),
      save: vi.fn((g: Partial<Group>) =>
        Promise.resolve({
          id: groupId,
          ...g,
          created_at: new Date(),
          updated_at: new Date(),
        }),
      ),
      findOne: vi.fn(),
      find: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    membersRepository = {
      create: vi.fn((dto: Partial<GroupMember>) => dto),
      save: vi.fn((m: Partial<GroupMember>) =>
        Promise.resolve({
          id: 'mem-id',
          ...m,
          created_at: new Date(),
          updated_at: new Date(),
        }),
      ),
      findOne: vi.fn(),
      remove: vi.fn(),
      find: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    usersService = {
      findByEmail: vi.fn(),
      findById: vi.fn().mockResolvedValue(mockLeader),
    };

    googleDriveService = {
      createFolder: vi.fn().mockResolvedValue({ id: 'drive-folder-1' }),
    };

    canvaService = {
      createPresentation: vi.fn(),
    };

    invitationsService = {
      createInvitation: vi.fn(),
    };

    googleCalendarService = {
      createEventWithMeetLink: vi.fn().mockResolvedValue({
        event_id: 'evt-cal',
        meet_link: 'https://meet.google.com/xxx-yyyy-zzz',
        html_link: 'https://calendar.google.com/event?eid=1',
        start: '2026-06-01T08:00:00.000Z',
        end: '2026-06-01T09:00:00.000Z',
      }),
      listEventsInRange: vi.fn().mockResolvedValue([]),
      createGroupCalendarEvent: vi.fn().mockResolvedValue({
        event_id: 'evt-shared',
        html_link: 'https://calendar.google.com/event?eid=2',
        start: '2026-06-01T08:00:00.000Z',
        end: '2026-06-01T09:00:00.000Z',
        meet_link: 'https://meet.google.com/zzz',
      }),
    };

    googleAccessTokenService = {
      resolveGoogleAccessToken: vi.fn().mockResolvedValue('google-access'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: getRepositoryToken(Group), useValue: groupsRepository },
        {
          provide: getRepositoryToken(GroupMember),
          useValue: membersRepository,
        },
        { provide: UsersService, useValue: usersService },
        { provide: GoogleDriveService, useValue: googleDriveService },
        { provide: CanvaService, useValue: canvaService },
        { provide: InvitationsService, useValue: invitationsService },
        { provide: GoogleCalendarService, useValue: googleCalendarService },
        {
          provide: GoogleAccessTokenService,
          useValue: googleAccessTokenService,
        },
      ],
    }).compile();

    service = module.get(GroupsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('persists group with leader_id and creates leader membership', async () => {
      const result = await service.create(leaderId, {
        name: 'Study Group',
        tags: [],
      });

      expect(result.leader_id).toBe(leaderId);
      expect(result.name).toBe('Study Group');
      expect(result.status).toBe(GroupStatus.ACTIVE);
      expect(groupsRepository.save).toHaveBeenCalled();
      expect(membersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: groupId,
          user_id: leaderId,
          is_active: true,
        }),
      );
    });

    it('attempts Drive folder provisioning when leader has access token', async () => {
      await service.create(leaderId, { name: 'G1' });

      expect(googleDriveService.createFolder).toHaveBeenCalledTimes(2);
      expect(googleDriveService.createFolder).toHaveBeenNthCalledWith(
        1,
        'g-token',
        'G1',
      );
      expect(googleDriveService.createFolder).toHaveBeenNthCalledWith(
        2,
        'g-token',
        'canva assets',
        'drive-folder-1',
      );
      expect(groupsRepository.save).toHaveBeenCalledTimes(2);
      expect(canvaService.createPresentation).not.toHaveBeenCalled();
    });

    it('creates Canva presentation when leader has Canva token', async () => {
      usersService.findById.mockResolvedValueOnce({
        ...mockLeader,
        canva_access_token: 'canva-token',
      });
      canvaService.createPresentation.mockResolvedValue({
        designId: 'DA999',
        viewUrl: 'https://canva.example/view',
      });

      const result = await service.create(leaderId, { name: 'WithCanva' });

      expect(canvaService.createPresentation).toHaveBeenCalledWith(
        'canva-token',
        'WithCanva',
      );
      expect(result.canva_file_url).toBe('https://canva.example/view');
      expect(result.canva_design_id).toBe('DA999');
    });

    it('handles Drive provisioning failure as partial success (nullable drive fields)', async () => {
      googleDriveService.createFolder.mockResolvedValue(null);

      const result = await service.create(leaderId, { name: 'NoDrive' });

      expect(result.id).toBe(groupId);
      expect(result.drive_folder_id).toBeUndefined();
    });

    it('persists report_date when provided', async () => {
      const result = await service.create(leaderId, {
        name: 'Dated',
        tags: [],
        report_date: '2026-09-15',
      });

      expect(groupsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Dated',
          report_date: expect.any(Date),
        }),
      );
      expect(result.report_date).toBeInstanceOf(Date);
      expect(result.report_date?.toISOString().slice(0, 10)).toBe('2026-09-15');
    });
  });

  describe('findOneForMember', () => {
    it('throws NotFound when group missing', async () => {
      groupsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneForMember(groupId, leaderId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws Forbidden when user is not an active member or leader', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        members: [{ user_id: 'other', is_active: true }],
      });

      await expect(
        service.findOneForMember(groupId, 'stranger-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('throws Forbidden when acting user is not leader', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
      });

      await expect(
        service.update(groupId, 'not-leader', { name: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('persists meet_link and report_date when leader updates', async () => {
      const existing: Partial<Group> = {
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        tags: [],
        status: GroupStatus.ACTIVE,
      };
      groupsRepository.findOne.mockResolvedValue(existing);

      await service.update(groupId, leaderId, {
        meet_link: 'https://meet.google.com/abc-defg-hij',
        report_date: '2026-06-15',
      });

      expect(groupsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          meet_link: 'https://meet.google.com/abc-defg-hij',
          report_date: expect.any(Date),
        }),
      );
      const saved = groupsRepository.save.mock.calls[0][0] as Group;
      expect(saved.report_date?.toISOString().slice(0, 10)).toBe('2026-06-15');
    });

    it('clears meet_link and report_date when leader sends null', async () => {
      const existing: Partial<Group> = {
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        tags: [],
        status: GroupStatus.ACTIVE,
        meet_link: 'https://meet.google.com/old',
        report_date: new Date('2026-01-01'),
      };
      groupsRepository.findOne.mockResolvedValue(existing);

      await service.update(groupId, leaderId, {
        meet_link: null,
        report_date: null,
      });

      expect(groupsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          meet_link: null,
          report_date: null,
        }),
      );
    });

    it('persists canva_file_url and doc_file_url when leader updates', async () => {
      const existing: Partial<Group> = {
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        tags: [],
        status: GroupStatus.ACTIVE,
      };
      groupsRepository.findOne.mockResolvedValue(existing);

      await service.update(groupId, leaderId, {
        canva_file_url: 'https://www.canva.com/design/X/view',
        doc_file_url: 'https://docs.google.com/document/d/y/edit',
      });

      expect(groupsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          canva_file_url: 'https://www.canva.com/design/X/view',
          doc_file_url: 'https://docs.google.com/document/d/y/edit',
        }),
      );
    });
  });

  describe('inviteMember', () => {
    it('rejects duplicate existing member', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
      });
      usersService.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'm@test.com',
      });
      membersRepository.findOne.mockResolvedValue({ id: 'gm' });

      await expect(
        service.inviteMember(groupId, leaderId, 'm@test.com'),
      ).rejects.toThrow(ConflictException);
    });

    it('delegates to InvitationsService when checks pass', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
      });
      usersService.findByEmail.mockResolvedValue(null);
      const invitation: Partial<GroupInvitation> = {
        token: 'tok',
        status: InvitationStatus.PENDING,
      };
      invitationsService.createInvitation.mockResolvedValue(
        invitation as GroupInvitation,
      );

      const result = await service.inviteMember(
        groupId,
        leaderId,
        'new@test.com',
      );

      expect(invitationsService.createInvitation).toHaveBeenCalledWith({
        groupId,
        invitedByUserId: leaderId,
        email: 'new@test.com',
      });
      expect(result.token).toBe('tok');
    });
  });

  describe('toggleMemberStatus', () => {
    it('throws when toggling leader membership', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
      });

      await expect(
        service.toggleMemberStatus(groupId, leaderId, leaderId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removeMember', () => {
    it('throws when removing leader', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
      });

      await expect(
        service.removeMember(groupId, leaderId, leaderId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createMeetEventAndInvite', () => {
    it('throws Forbidden when acting user is not leader', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: GroupStatus.ACTIVE,
      });

      await expect(
        service.createMeetEventAndInvite(groupId, 'not-leader', {
          start: '2026-06-01T08:00:00.000Z',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws Forbidden when group is locked', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: GroupStatus.LOCKED,
      });

      await expect(
        service.createMeetEventAndInvite(groupId, leaderId, {
          start: '2026-06-01T08:00:00.000Z',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequest when no invitable member emails', async () => {
      groupsRepository.findOne
        .mockResolvedValueOnce({
          id: groupId,
          leader_id: leaderId,
          name: 'G',
          status: GroupStatus.ACTIVE,
        })
        .mockResolvedValueOnce({
          id: groupId,
          leader_id: leaderId,
          name: 'G',
          status: GroupStatus.ACTIVE,
        });
      membersRepository.find.mockResolvedValue([
        {
          user_id: leaderId,
          is_active: true,
          created_at: new Date(),
          user: { email: '', full_name: 'L' },
        },
      ]);

      await expect(
        service.createMeetEventAndInvite(groupId, leaderId, {
          start: '2026-06-01T08:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults end to start + 1h when end omitted and calls Calendar service', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'My Group',
        status: GroupStatus.ACTIVE,
      });
      membersRepository.find.mockResolvedValue([
        {
          user_id: leaderId,
          is_active: true,
          created_at: new Date(),
          user: { email: 'leader@test.com', full_name: 'L' },
        },
      ]);

      const startIso = '2026-06-01T08:00:00.000Z';
      const result = await service.createMeetEventAndInvite(groupId, leaderId, {
        start: startIso,
      });

      expect(googleAccessTokenService.resolveGoogleAccessToken).toHaveBeenCalled();
      expect(googleCalendarService.createEventWithMeetLink).toHaveBeenCalledWith(
        'google-access',
        expect.objectContaining({
          summary: 'My Group — NTU Study',
          attendeeEmails: ['leader@test.com'],
        }),
      );
      const calArg = googleCalendarService.createEventWithMeetLink.mock
        .calls[0][1] as { start: Date; end: Date };
      expect(calArg.start.toISOString()).toBe(startIso);
      expect(calArg.end.getTime() - calArg.start.getTime()).toBe(60 * 60 * 1000);
      expect(result.meet_link).toContain('meet.google.com');
    });
  });

  describe('listGroupCalendarEvents', () => {
    it('throws BadRequest when google_calendar_id is not set', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        status: GroupStatus.ACTIVE,
        google_calendar_id: null,
      });

      await expect(
        service.listGroupCalendarEvents(
          groupId,
          leaderId,
          '2026-06-01T00:00:00.000Z',
          '2026-06-08T00:00:00.000Z',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lists events using leader token', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        status: GroupStatus.ACTIVE,
        google_calendar_id: 'shared@group.calendar.google.com',
      });

      googleCalendarService.listEventsInRange.mockResolvedValue([
        {
          id: 'ev1',
          summary: 'Meet',
          start: { dateTime: '2026-06-02T10:00:00.000Z' },
          end: { dateTime: '2026-06-02T11:00:00.000Z' },
          html_link: 'https://calendar.google.com/a',
          meet_link: null,
        },
      ]);

      const rows = await service.listGroupCalendarEvents(
        groupId,
        leaderId,
        '2026-06-01T00:00:00.000Z',
        '2026-06-08T00:00:00.000Z',
      );

      expect(rows).toHaveLength(1);
      expect(googleCalendarService.listEventsInRange).toHaveBeenCalledWith(
        'google-access',
        'shared@group.calendar.google.com',
        expect.any(Date),
        expect.any(Date),
      );
    });
  });

  describe('createGroupCalendarEventAndInvite', () => {
    it('throws Forbidden for non-leader', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        status: GroupStatus.ACTIVE,
        google_calendar_id: 'cal@x',
      });

      await expect(
        service.createGroupCalendarEventAndInvite(groupId, 'other-user-id', {
          start: '2026-06-01T08:00:00.000Z',
          end: '2026-06-01T09:00:00.000Z',
          mode: 'offline',
          place_name: 'Campus',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequest when group_meet_link option but meet_link missing', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: GroupStatus.ACTIVE,
        google_calendar_id: 'cal@x',
        meet_link: null,
      });
      membersRepository.find.mockResolvedValue([
        {
          user_id: leaderId,
          is_active: true,
          created_at: new Date(),
          user: { email: 'leader@test.com', full_name: 'L' },
        },
      ]);

      await expect(
        service.createGroupCalendarEventAndInvite(groupId, leaderId, {
          start: '2026-06-01T08:00:00.000Z',
          end: '2026-06-01T09:00:00.000Z',
          mode: 'online',
          online_option: 'group_meet_link',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls createGroupCalendarEvent for offline booking', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'Lab Group',
        status: GroupStatus.ACTIVE,
        google_calendar_id: 'cal@x',
      });
      membersRepository.find.mockResolvedValue([
        {
          user_id: leaderId,
          is_active: true,
          created_at: new Date(),
          user: { email: 'leader@test.com', full_name: 'L' },
        },
      ]);

      await service.createGroupCalendarEventAndInvite(groupId, leaderId, {
        start: '2026-06-01T08:00:00.000Z',
        end: '2026-06-01T09:00:00.000Z',
        mode: 'offline',
        place_name: 'Library',
        address_detail: 'L2',
      });

      expect(googleCalendarService.createGroupCalendarEvent).toHaveBeenCalledWith(
        'google-access',
        expect.objectContaining({
          calendarId: 'cal@x',
          mode: 'offline',
          place_name: 'Library',
        }),
      );
    });
  });
});
