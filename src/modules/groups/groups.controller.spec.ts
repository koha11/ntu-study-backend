import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

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
  };

  beforeEach(async () => {
    groupsService = {
      create: vi.fn(),
      findUserGroups: vi.fn(),
      findOneForMember: vi.fn(),
      update: vi.fn(),
      getMembers: vi.fn(),
      createMeetEventAndInvite: vi.fn(),
      inviteMember: vi.fn(),
      toggleMemberStatus: vi.fn(),
      removeMember: vi.fn(),
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

  it('create maps jwt user id to service', async () => {
    await controller.create({ user: { id: 'user-1' } } as never, {
      name: 'G',
      tags: [],
    });
    expect(groupsService.create).toHaveBeenCalledWith('user-1', {
      name: 'G',
      tags: [],
    });
  });

  it('createMeetEvent forwards to service', async () => {
    groupsService.createMeetEventAndInvite.mockResolvedValue({
      event_id: 'e1',
      meet_link: 'https://meet.google.com/x',
      html_link: 'https://cal',
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-01T01:00:00.000Z',
    });

    const dto = { start: '2026-01-01T00:00:00.000Z' };
    await controller.createMeetEvent(
      { user: { id: 'leader-id' } } as never,
      'g1',
      dto,
    );

    expect(groupsService.createMeetEventAndInvite).toHaveBeenCalledWith(
      'g1',
      'leader-id',
      dto,
    );
  });

  it('removeMember forwards ids', async () => {
    await controller.removeMember(
      { user: { id: 'leader' } } as never,
      'g1',
      'u2',
    );
    expect(groupsService.removeMember).toHaveBeenCalledWith(
      'g1',
      'leader',
      'u2',
    );
  });
});
