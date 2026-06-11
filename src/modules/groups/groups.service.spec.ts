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
import { EmailService } from '@common/services/email.service';
import { GroupEmailThreadService } from '@common/services/group-email-thread.service';
import { ConfigService } from '@nestjs/config';

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
    createSecondaryCalendar: ReturnType<typeof vi.fn>;
  };
  let googleAccessTokenService: {
    resolveGoogleAccessToken: ReturnType<typeof vi.fn>;
  };
  let emailService: { sendGroupCreatedEmail: ReturnType<typeof vi.fn> };
  let groupEmailThreadService: {
    findByGroupAndUser: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
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
      createSecondaryCalendar: vi.fn().mockResolvedValue(null),
    };

    googleAccessTokenService = {
      resolveGoogleAccessToken: vi.fn().mockResolvedValue('google-access'),
    };

    emailService = {
      sendGroupCreatedEmail: vi
        .fn()
        .mockResolvedValue('<created@ntu-study.local>'),
    };

    groupEmailThreadService = {
      findByGroupAndUser: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'thread-1',
        thread_message_id: '<created@ntu-study.local>',
      }),
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
        { provide: EmailService, useValue: emailService },
        { provide: GroupEmailThreadService, useValue: groupEmailThreadService },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue('http://localhost:5173') },
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
        'google-access',
        'G1',
      );
      expect(googleDriveService.createFolder).toHaveBeenNthCalledWith(
        2,
        'google-access',
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

    it('sets google_calendar_id when Calendar API returns a calendar id', async () => {
      googleCalendarService.createSecondaryCalendar.mockResolvedValue(
        'g@group.calendar.google.com',
      );

      const result = await service.create(leaderId, { name: 'CalGroup' });

      expect(
        googleAccessTokenService.resolveGoogleAccessToken,
      ).toHaveBeenCalledWith(expect.objectContaining({ id: leaderId }));
      expect(
        googleCalendarService.createSecondaryCalendar,
      ).toHaveBeenCalledWith(
        'google-access',
        'CalGroup',
        'Shared calendar for this NTU Study group.',
      );
      expect(result.google_calendar_id).toBe('g@group.calendar.google.com');
    });

    it('leaves google_calendar_id unset when Calendar API returns null', async () => {
      googleCalendarService.createSecondaryCalendar.mockResolvedValue(null);

      const result = await service.create(leaderId, { name: 'NoCal' });

      expect(googleCalendarService.createSecondaryCalendar).toHaveBeenCalled();
      expect(result.google_calendar_id).toBeUndefined();
    });

    it('skips calendar provisioning when Google token cannot be resolved', async () => {
      googleAccessTokenService.resolveGoogleAccessToken.mockResolvedValue(null);

      const result = await service.create(leaderId, { name: 'NoTok' });

      expect(
        googleCalendarService.createSecondaryCalendar,
      ).not.toHaveBeenCalled();
      expect(result.google_calendar_id).toBeUndefined();
    });

    it('sends a group-created email to the leader after creation', async () => {
      await service.create(leaderId, { name: 'ThreadGroup' });

      expect(emailService.sendGroupCreatedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: mockLeader.email,
          leaderName: mockLeader.full_name,
          groupName: 'ThreadGroup',
        }),
      );
    });

    it('stores the returned messageId as the leader thread root', async () => {
      await service.create(leaderId, { name: 'ThreadGroup' });

      expect(groupEmailThreadService.create).toHaveBeenCalledWith(
        groupId,
        leaderId,
        '<created@ntu-study.local>',
      );
    });

    it('skips thread creation when the leader email fails', async () => {
      emailService.sendGroupCreatedEmail.mockResolvedValueOnce(null);

      await service.create(leaderId, { name: 'FailMail' });

      expect(groupEmailThreadService.create).not.toHaveBeenCalled();
    });

    it('skips group-created email when leader has notifications disabled', async () => {
      usersService.findById.mockResolvedValue({
        ...mockLeader,
        notification_enabled: false,
      });

      await service.create(leaderId, { name: 'SilentGroup' });

      expect(emailService.sendGroupCreatedEmail).not.toHaveBeenCalled();
      expect(groupEmailThreadService.create).not.toHaveBeenCalled();
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

      expect(
        googleAccessTokenService.resolveGoogleAccessToken,
      ).toHaveBeenCalled();
      expect(
        googleCalendarService.createEventWithMeetLink,
      ).toHaveBeenCalledWith(
        'google-access',
        expect.objectContaining({
          summary: 'My Group — NTU Study',
          attendeeEmails: ['leader@test.com'],
        }),
      );
      const calArg = googleCalendarService.createEventWithMeetLink.mock
        .calls[0][1] as { start: Date; end: Date };
      expect(calArg.start.toISOString()).toBe(startIso);
      expect(calArg.end.getTime() - calArg.start.getTime()).toBe(
        60 * 60 * 1000,
      );
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

      expect(
        googleCalendarService.createGroupCalendarEvent,
      ).toHaveBeenCalledWith(
        'google-access',
        expect.objectContaining({
          calendarId: 'cal@x',
          mode: 'offline',
          place_name: 'Library',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findUserGroups
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // createMeetEventAndInvite — error handling branches (lines 580, 598-602)
  // ---------------------------------------------------------------------------
  describe('createMeetEventAndInvite — error handling', () => {
    const dto = { title: 'Sync', start: '2026-06-01T10:00:00Z' };

    it('throws ForbiddenException when leader has no Google access token', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: 'active',
      } as Group);
      membersRepository.findOne.mockResolvedValue({
        user_id: leaderId,
        is_active: true,
      });
      membersRepository.find.mockResolvedValue([
        { user_id: leaderId, is_active: true, user: { email: 'l@t.com' } },
      ]);
      usersService.findById.mockResolvedValue({
        id: leaderId,
        email: 'l@t.com',
        google_access_token: null,
      });
      googleAccessTokenService.resolveGoogleAccessToken.mockResolvedValue(null);

      await expect(
        service.createMeetEventAndInvite(groupId, leaderId, dto as never),
      ).rejects.toThrow(/Google Calendar access/);
    });

    it('throws ForbiddenException when createEventWithMeetLink throws grant-calendar error', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: 'active',
      } as Group);
      membersRepository.findOne.mockResolvedValue({ user_id: leaderId });
      membersRepository.find.mockResolvedValue([
        { user_id: leaderId, is_active: true, user: { email: 'l@t.com' } },
      ]);
      usersService.findById.mockResolvedValue({
        id: leaderId,
        email: 'l@t.com',
        google_access_token: 'tok',
      });
      googleCalendarService.createEventWithMeetLink.mockRejectedValue(
        new Error('Please sign in again to grant calendar permission'),
      );

      await expect(
        service.createMeetEventAndInvite(groupId, leaderId, dto as never),
      ).rejects.toThrow(/sign in again/i);
    });

    it('uses default 1-hour end time when end_time not provided', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: 'active',
      } as Group);
      membersRepository.findOne.mockResolvedValue({ user_id: leaderId });
      membersRepository.find.mockResolvedValue([
        { user_id: leaderId, is_active: true, user: { email: 'l@t.com' } },
      ]);
      usersService.findById.mockResolvedValue({
        id: leaderId,
        email: 'l@t.com',
        google_access_token: 'tok',
      });
      googleCalendarService.createEventWithMeetLink.mockResolvedValue({
        event_id: 'evt1',
        meet_link: 'https://meet.google.com/abc',
        html_link: 'https://cal.com',
        start: '2026-06-01T10:00:00Z',
        end: '2026-06-01T11:00:00Z',
      });

      const result = await service.createMeetEventAndInvite(groupId, leaderId, {
        title: 'Sync',
        start: '2026-06-01T10:00:00Z',
        // No end_time provided
      } as never);

      expect(result.meet_link).toBeDefined();
    });

    it('throws NotFoundException when leader user not found', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: 'active',
      } as Group);
      membersRepository.findOne.mockResolvedValue({ user_id: leaderId });
      // Provide at least one active member with email to pass the "no members" check
      membersRepository.find.mockResolvedValue([
        {
          user_id: leaderId,
          is_active: true,
          user: { email: 'l@t.com' },
        },
      ]);
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.createMeetEventAndInvite(groupId, leaderId, {
          title: 'Sync',
          start: '2026-06-01T10:00:00Z',
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('accepts valid explicit end time (covers lines 545-546)', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: 'active',
      } as Group);
      membersRepository.findOne.mockResolvedValue({ user_id: leaderId });
      membersRepository.find.mockResolvedValue([
        { user_id: leaderId, is_active: true, user: { email: 'l@t.com' } },
      ]);
      usersService.findById.mockResolvedValue({
        id: leaderId,
        email: 'l@t.com',
        google_access_token: 'tok',
      });
      googleCalendarService.createEventWithMeetLink.mockResolvedValue({
        event_id: 'e1',
        meet_link: 'https://meet.google.com/abc',
        html_link: 'h',
        start: 's',
        end: 'e',
      });

      const result = await service.createMeetEventAndInvite(groupId, leaderId, {
        title: 'Sync',
        start: '2026-06-01T10:00:00Z',
        end: '2026-06-01T11:00:00Z',
      } as never);

      expect(result.meet_link).toBeDefined();
    });

    it('throws BadRequestException when start time is invalid (covers line 539)', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: 'active',
      } as Group);
      membersRepository.findOne.mockResolvedValue({ user_id: leaderId });

      await expect(
        service.createMeetEventAndInvite(groupId, leaderId, {
          title: 'Sync',
          start: 'not-a-date',
        } as never),
      ).rejects.toThrow(/Invalid start time/);
    });

    it('throws BadRequestException when end time is invalid (covers line 547)', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: 'active',
      } as Group);
      membersRepository.findOne.mockResolvedValue({ user_id: leaderId });

      await expect(
        service.createMeetEventAndInvite(groupId, leaderId, {
          title: 'Sync',
          start: '2026-06-01T10:00:00Z',
          end: 'not-a-date',
        } as never),
      ).rejects.toThrow(/Invalid end time/);
    });

    it('throws BadRequestException when end time is before start time (covers line 554)', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: 'active',
      } as Group);
      membersRepository.findOne.mockResolvedValue({ user_id: leaderId });

      await expect(
        service.createMeetEventAndInvite(groupId, leaderId, {
          title: 'Sync',
          start: '2026-06-01T11:00:00Z',
          end: '2026-06-01T10:00:00Z',
        } as never),
      ).rejects.toThrow(/End time must be after start time/);
    });

    it('throws BadRequestException when createEventWithMeetLink throws generic error', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        status: 'active',
      } as Group);
      membersRepository.findOne.mockResolvedValue({ user_id: leaderId });
      membersRepository.find.mockResolvedValue([
        { user_id: leaderId, is_active: true, user: { email: 'l@t.com' } },
      ]);
      usersService.findById.mockResolvedValue({
        id: leaderId,
        email: 'l@t.com',
        google_access_token: 'tok',
      });
      googleCalendarService.createEventWithMeetLink.mockRejectedValue(
        new Error('Calendar quota exceeded'),
      );

      await expect(
        service.createMeetEventAndInvite(groupId, leaderId, dto as never),
      ).rejects.toThrow(/Calendar quota exceeded/);
    });
  });

  describe('findUserGroups', () => {
    it('returns empty array when user has no active memberships', async () => {
      membersRepository.find.mockResolvedValue([]);

      const result = await service.findUserGroups(leaderId);

      expect(result).toEqual([]);
    });

    it('returns mapped group summaries with member counts', async () => {
      membersRepository.find.mockResolvedValue([{ group_id: groupId }]);
      groupsRepository.find.mockResolvedValue([
        {
          id: groupId,
          name: 'Study Squad',
          description: 'A group',
          leader_id: leaderId,
          created_at: new Date(),
        },
      ]);
      const qb = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi
          .fn()
          .mockResolvedValue([{ group_id: groupId, cnt: '5' }]),
      };
      membersRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findUserGroups(leaderId);

      expect(result).toHaveLength(1);
      expect(result[0].member_count).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // findOneForMember — access checks
  // ---------------------------------------------------------------------------
  describe('findOneForMember', () => {
    it('returns group when user is leader', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
      } as Group);

      const result = await service.findOneForMember(groupId, leaderId);

      expect(result.id).toBe(groupId);
    });

    it('returns group when user is an active member', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: 'other-leader',
        name: 'G',
      } as Group);
      membersRepository.findOne.mockResolvedValue({
        user_id: leaderId,
        is_active: true,
      });

      const result = await service.findOneForMember(groupId, leaderId);

      expect(result.id).toBe(groupId);
    });

    it('throws ForbiddenException when user is not a member', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: 'other',
        name: 'G',
      } as Group);
      membersRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneForMember(groupId, leaderId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when group does not exist', async () => {
      groupsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOneForMember('bad-id', leaderId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // getCanvaPreview
  // ---------------------------------------------------------------------------
  describe('getCanvaPreview', () => {
    const group = {
      id: groupId,
      leader_id: leaderId,
      name: 'G',
      canva_design_id: 'DA123',
    } as Group;

    beforeEach(() => {
      groupsRepository.findOne.mockResolvedValue(group);
      membersRepository.findOne.mockResolvedValue({
        user_id: leaderId,
        is_active: true,
      });
    });

    it('returns empty when group has no canva_design_id', async () => {
      groupsRepository.findOne.mockResolvedValue({
        ...group,
        canva_design_id: null,
      } as unknown as Group);

      const result = await service.getCanvaPreview(groupId, leaderId);

      expect(result.editUrl).toBeNull();
      expect(result.pages).toEqual([]);
    });

    it('returns empty when leader has no canva tokens', async () => {
      usersService.findById.mockResolvedValue({
        id: leaderId,
        canva_access_token: null,
        canva_refresh_token: null,
      });

      const result = await service.getCanvaPreview(groupId, leaderId);

      expect(result.editUrl).toBeNull();
    });

    it('returns design and pages when leader has valid access token', async () => {
      usersService.findById.mockResolvedValue({
        id: leaderId,
        canva_access_token: 'at-valid',
        canva_refresh_token: 'rt',
        canva_token_expires_at: new Date(Date.now() + 3600_000),
      });
      (
        canvaService as unknown as {
          getDesign: ReturnType<typeof vi.fn>;
          getDesignPages: ReturnType<typeof vi.fn>;
        }
      ).getDesign = vi
        .fn()
        .mockResolvedValue({ editUrl: 'https://canva.com/edit/DA123' });
      (
        canvaService as unknown as {
          getDesign: ReturnType<typeof vi.fn>;
          getDesignPages: ReturnType<typeof vi.fn>;
        }
      ).getDesignPages = vi
        .fn()
        .mockResolvedValue([
          { index: 1, thumbnailUrl: 'https://img.canva.com' },
        ]);

      const result = await service.getCanvaPreview(groupId, leaderId);

      expect(result.editUrl).toBe('https://canva.com/edit/DA123');
      expect(result.pages).toHaveLength(1);
    });

    it('refreshes expired token before fetching design', async () => {
      const expiredAt = new Date(Date.now() - 3600_000);
      usersService.findById.mockResolvedValue({
        id: leaderId,
        canva_access_token: 'expired-token',
        canva_refresh_token: 'refresh-token',
        canva_token_expires_at: expiredAt,
      });
      canvaService.createPresentation = vi.fn();
      (canvaService as unknown as Record<string, ReturnType<typeof vi.fn>>)[
        'refreshAccessToken'
      ] = vi.fn().mockResolvedValue({
        access_token: 'new-at',
        refresh_token: 'new-rt',
        expires_in: 3600,
      });
      (canvaService as unknown as Record<string, ReturnType<typeof vi.fn>>)[
        'getDesign'
      ] = vi.fn().mockResolvedValue({ editUrl: null });
      (canvaService as unknown as Record<string, ReturnType<typeof vi.fn>>)[
        'getDesignPages'
      ] = vi.fn().mockResolvedValue([]);
      (usersService as unknown as { update: ReturnType<typeof vi.fn> }).update =
        vi.fn().mockResolvedValue({});

      await service.getCanvaPreview(groupId, leaderId);

      expect(
        (canvaService as unknown as Record<string, ReturnType<typeof vi.fn>>)[
          'refreshAccessToken'
        ],
      ).toHaveBeenCalledWith('refresh-token');
    });
  });

  // ---------------------------------------------------------------------------
  // listGroupCalendarEvents — additional branches
  // ---------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // requireGroup null path (covers the private helper throw branch)
  // -------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // create — additional branch coverage for integration failure paths
  // ---------------------------------------------------------------------------
  describe('create — branch coverage for optional integrations', () => {
    it('skips Drive folder when leader not found', async () => {
      usersService.findById.mockResolvedValue(null);

      const result = await service.create(leaderId, {
        name: 'No Drive Group',
        tags: [],
      });

      expect(googleDriveService.createFolder).not.toHaveBeenCalled();
      expect(result.id).toBe(groupId);
    });

    it('skips Drive folder when leader has no Google access token', async () => {
      usersService.findById.mockResolvedValue({
        id: leaderId,
        email: 'l@t.com',
      });
      googleAccessTokenService.resolveGoogleAccessToken.mockResolvedValue(null);

      await service.create(leaderId, { name: 'No Token Group', tags: [] });

      expect(googleDriveService.createFolder).not.toHaveBeenCalled();
    });

    it('skips saving folder id when Drive folder creation returns no id', async () => {
      googleDriveService.createFolder.mockResolvedValueOnce(null);

      const result = await service.create(leaderId, {
        name: 'No Folder Id',
        tags: [],
      });

      expect(result.id).toBe(groupId);
      // folder id would not be saved
    });

    it('skips Canva when leader has no canva_access_token', async () => {
      usersService.findById.mockResolvedValue({
        id: leaderId,
        email: 'l@t.com',
        google_access_token: 'g-token',
        notification_enabled: true,
        full_name: 'Leader',
        canva_access_token: null,
      });

      await service.create(leaderId, { name: 'No Canva Group', tags: [] });

      expect(canvaService.createPresentation).not.toHaveBeenCalled();
    });

    it('skips saving Canva design when createPresentation returns null', async () => {
      usersService.findById.mockResolvedValue({
        ...mockLeader,
        canva_access_token: 'canva-token',
      });
      canvaService.createPresentation.mockResolvedValue(null);

      const result = await service.create(leaderId, {
        name: 'No Canva Result',
        tags: [],
      });

      expect(result.id).toBe(groupId);
    });

    it('skips email when leader has notifications disabled', async () => {
      usersService.findById.mockResolvedValue({
        ...mockLeader,
        notification_enabled: false,
      });

      await service.create(leaderId, { name: 'No Email Group', tags: [] });

      expect(emailService.sendGroupCreatedEmail).not.toHaveBeenCalled();
    });

    it('skips thread creation when email send returns null', async () => {
      emailService.sendGroupCreatedEmail.mockResolvedValue(null);

      await service.create(leaderId, { name: 'No Thread Group', tags: [] });

      expect(groupEmailThreadService.create).not.toHaveBeenCalled();
    });
  });

  describe('update — group not found', () => {
    it('throws NotFoundException when group does not exist', async () => {
      groupsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', leaderId, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // toggleMemberStatus — success case covers the non-leader path
  // ---------------------------------------------------------------------------
  describe('toggleMemberStatus', () => {
    const memberId = 'mmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm';

    it('toggles is_active for a non-leader member', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
      } as Group);
      membersRepository.findOne.mockResolvedValue({
        user_id: memberId,
        is_active: true,
      } as GroupMember);
      membersRepository.save.mockImplementation((m: GroupMember) =>
        Promise.resolve({ ...m, is_active: false }),
      );

      const result = await service.toggleMemberStatus(
        groupId,
        leaderId,
        memberId,
      );

      expect(membersRepository.save).toHaveBeenCalled();
      expect(result).toMatchObject({ is_active: false });
    });

    it('throws NotFoundException when member does not exist', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
      } as Group);
      membersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.toggleMemberStatus(groupId, leaderId, memberId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // removeMember — member not found
  // ---------------------------------------------------------------------------
  describe('removeMember — member not found', () => {
    const memberId = 'nnnn-nnnn-nnnn-nnnn-nnnnnnnnnnnn';

    it('throws NotFoundException when member record does not exist', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
      } as Group);
      membersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeMember(groupId, leaderId, memberId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listGroupCalendarEvents', () => {
    it('throws BadRequestException when group has no calendar configured', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        google_calendar_id: null,
      } as Group);

      await expect(
        service.listGroupCalendarEvents(
          groupId,
          leaderId,
          '2026-06-01',
          '2026-06-30',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when time range is invalid', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        google_calendar_id: 'cal@g.com',
      } as Group);
      membersRepository.findOne.mockResolvedValue({ user_id: leaderId });

      await expect(
        service.listGroupCalendarEvents(
          groupId,
          leaderId,
          'invalid',
          '2026-06-30',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when time_max <= time_min', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        google_calendar_id: 'cal@g.com',
      } as Group);

      await expect(
        service.listGroupCalendarEvents(
          groupId,
          leaderId,
          '2026-06-30',
          '2026-06-01',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when leader has no Google access token', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: leaderId,
        name: 'G',
        google_calendar_id: 'cal@g.com',
      } as Group);
      usersService.findById.mockResolvedValue({
        id: leaderId,
        google_access_token: null,
      });
      googleAccessTokenService.resolveGoogleAccessToken.mockResolvedValue(null);

      await expect(
        service.listGroupCalendarEvents(
          groupId,
          leaderId,
          '2026-06-01',
          '2026-06-30',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
