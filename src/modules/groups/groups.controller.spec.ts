import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import type { Request } from 'express';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';

const makeReq = (userId: string): Request =>
  ({ user: { id: userId } as JwtRequestUser }) as unknown as Request;

describe('GroupsController', () => {
  let controller: GroupsController;
  let groupsService: {
    create: ReturnType<typeof vi.fn>;
    findUserGroups: ReturnType<typeof vi.fn>;
    findOneForMember: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    getMembers: ReturnType<typeof vi.fn>;
    createMeetEventAndInvite: ReturnType<typeof vi.fn>;
    inviteMember: ReturnType<typeof vi.fn>;
    toggleMemberStatus: ReturnType<typeof vi.fn>;
    removeMember: ReturnType<typeof vi.fn>;
    listGroupCalendarEvents: ReturnType<typeof vi.fn>;
    createGroupCalendarEventAndInvite: ReturnType<typeof vi.fn>;
    getCanvaPreview: ReturnType<typeof vi.fn>;
  };

  const userId = 'user-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const groupId = 'bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(async () => {
    groupsService = {
      create: vi.fn().mockResolvedValue({ id: groupId }),
      findUserGroups: vi.fn().mockResolvedValue([]),
      findOneForMember: vi.fn().mockResolvedValue({ id: groupId }),
      update: vi.fn().mockResolvedValue({ id: groupId }),
      getMembers: vi.fn().mockResolvedValue([]),
      createMeetEventAndInvite: vi
        .fn()
        .mockResolvedValue({ meet_link: 'https://meet.google.com/abc' }),
      inviteMember: vi.fn().mockResolvedValue({ status: 'pending' }),
      toggleMemberStatus: vi.fn().mockResolvedValue({ is_active: false }),
      removeMember: vi.fn().mockResolvedValue(undefined),
      listGroupCalendarEvents: vi.fn().mockResolvedValue([]),
      createGroupCalendarEventAndInvite: vi
        .fn()
        .mockResolvedValue({ event_id: 'evt-1' }),
      getCanvaPreview: vi
        .fn()
        .mockResolvedValue({ thumbnail_url: 'https://example.com/img' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupsController],
      providers: [{ provide: GroupsService, useValue: groupsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(GroupsController);
  });

  describe('create', () => {
    it('delegates to service with userId and dto', async () => {
      const dto = { name: 'CS Group', tags: [] };
      await controller.create(makeReq(userId), dto as never);
      expect(groupsService.create).toHaveBeenCalledWith(userId, dto);
    });
  });

  describe('findUserGroups', () => {
    it('returns groups for the authenticated user', async () => {
      groupsService.findUserGroups.mockResolvedValue([
        { id: groupId, name: 'G1' },
      ]);
      const result = await controller.findUserGroups(makeReq(userId));
      expect(groupsService.findUserGroups).toHaveBeenCalledWith(userId);
      expect(result).toHaveLength(1);
    });
  });

  describe('listCalendarEvents', () => {
    it('delegates with groupId, userId, and time range', async () => {
      const query = { time_min: '2026-01-01', time_max: '2026-01-31' };
      await controller.listCalendarEvents(
        makeReq(userId),
        groupId,
        query as never,
      );
      expect(groupsService.listGroupCalendarEvents).toHaveBeenCalledWith(
        groupId,
        userId,
        query.time_min,
        query.time_max,
      );
    });
  });

  describe('createGroupCalendarEvent', () => {
    it('delegates to service and returns event', async () => {
      const body = {
        title: 'Study Session',
        start: '2026-06-01T10:00:00Z',
        end: '2026-06-01T12:00:00Z',
      };
      const result = await controller.createGroupCalendarEvent(
        makeReq(userId),
        groupId,
        body as never,
      );
      expect(
        groupsService.createGroupCalendarEventAndInvite,
      ).toHaveBeenCalledWith(groupId, userId, body);
      expect(result).toEqual({ event_id: 'evt-1' });
    });
  });

  describe('getCanvaPreview', () => {
    it('returns canva preview for group member', async () => {
      const result = await controller.getCanvaPreview(makeReq(userId), groupId);
      expect(groupsService.getCanvaPreview).toHaveBeenCalledWith(
        groupId,
        userId,
      );
      expect(result).toHaveProperty('thumbnail_url');
    });
  });

  describe('findOne', () => {
    it('returns group details for member', async () => {
      const result = await controller.findOne(makeReq(userId), groupId);
      expect(groupsService.findOneForMember).toHaveBeenCalledWith(
        groupId,
        userId,
      );
      expect(result).toEqual({ id: groupId });
    });
  });

  describe('update', () => {
    it('delegates update to service', async () => {
      const dto = { name: 'Updated Name' };
      await controller.update(makeReq(userId), groupId, dto as never);
      expect(groupsService.update).toHaveBeenCalledWith(groupId, userId, dto);
    });
  });

  describe('getMembers', () => {
    it('returns members list', async () => {
      groupsService.getMembers.mockResolvedValue([
        { user_id: userId, full_name: 'Alice' },
      ]);
      const result = await controller.getMembers(makeReq(userId), groupId);
      expect(groupsService.getMembers).toHaveBeenCalledWith(groupId, userId);
      expect(result).toHaveLength(1);
    });
  });

  describe('createMeetEvent', () => {
    it('forwards to service with dto', async () => {
      const dto = {
        title: 'Sync',
        start: '2026-06-01T10:00:00Z',
        end: '2026-06-01T11:00:00Z',
      };
      await controller.createMeetEvent(makeReq(userId), groupId, dto as never);
      expect(groupsService.createMeetEventAndInvite).toHaveBeenCalledWith(
        groupId,
        userId,
        dto,
      );
    });
  });

  describe('inviteMember', () => {
    it('delegates invitation to service', async () => {
      const dto = { email: 'member@test.com' };
      await controller.inviteMember(makeReq(userId), groupId, dto as never);
      expect(groupsService.inviteMember).toHaveBeenCalledWith(
        groupId,
        userId,
        dto.email,
      );
    });
  });

  describe('toggleMemberStatus', () => {
    it('calls service with group, caller, and target user ids', async () => {
      const targetUserId = 'cccc-cccc-cccc-cccc-cccccccccccc';
      await controller.toggleMemberStatus(
        makeReq(userId),
        groupId,
        targetUserId,
      );
      expect(groupsService.toggleMemberStatus).toHaveBeenCalledWith(
        groupId,
        userId,
        targetUserId,
      );
    });
  });

  describe('removeMember', () => {
    it('forwards ids to service', async () => {
      const targetUserId = 'dddd-dddd-dddd-dddd-dddddddddddd';
      await controller.removeMember(makeReq(userId), groupId, targetUserId);
      expect(groupsService.removeMember).toHaveBeenCalledWith(
        groupId,
        userId,
        targetUserId,
      );
    });
  });
});
