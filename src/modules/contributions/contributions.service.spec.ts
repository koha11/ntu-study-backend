import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContributionsService } from './contributions.service';
import { ContributionRating } from './entities/contribution-rating.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { Task } from '@modules/tasks/entities/task.entity';
import { User } from '@modules/users/entities/user.entity';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '@common/services/email.service';
import { GroupEmailThreadService } from '@common/services/group-email-thread.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '@modules/notifications/notifications.service';

describe('ContributionsService', () => {
  let service: ContributionsService;
  let ratingsRepository: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    create: (data: unknown) => unknown;
    save: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let groupsRepository: { findOne: ReturnType<typeof vi.fn> };
  let membersRepository: { find: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };
  let tasksRepository: { find: ReturnType<typeof vi.fn> };
  let usersRepository: { find: ReturnType<typeof vi.fn> };
  let emailService: {
    sendContributionOpenEmail: ReturnType<typeof vi.fn>;
    sendContributionClosedEmail: ReturnType<typeof vi.fn>;
  };
  let groupEmailThreadService: { findByGroupAndUser: ReturnType<typeof vi.fn> };
  let notificationsService: { createNotification: ReturnType<typeof vi.fn> };

  const qbChain = {
    select: function () { return this; },
    addSelect: function () { return this; },
    distinct: function () { return this; },
    where: function () { return this; },
    andWhere: function () { return this; },
    groupBy: function () { return this; },
    addGroupBy: function () { return this; },
    orderBy: function () { return this; },
    innerJoin: function () { return this; },
    innerJoinAndSelect: function () { return this; },
    leftJoinAndSelect: function () { return this; },
    update: function () { return this; },
    set: function () { return this; },
    execute: vi.fn().mockResolvedValue({ affected: 0 }),
    getMany: vi.fn().mockResolvedValue([]),
    getRawMany: vi.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    ratingsRepository = {
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([]),
      create: (data: unknown) => data,
      save: vi.fn().mockResolvedValue([]),
      createQueryBuilder: vi.fn().mockReturnValue(qbChain),
    };
    groupsRepository = { findOne: vi.fn().mockResolvedValue(null) };
    membersRepository = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
    };
    tasksRepository = { find: vi.fn().mockResolvedValue([]) };
    usersRepository = { find: vi.fn().mockResolvedValue([]) };
    emailService = {
      sendContributionOpenEmail: vi.fn().mockResolvedValue('<contrib@ntu-study.local>'),
      sendContributionClosedEmail: vi.fn().mockResolvedValue('<closed@ntu-study.local>'),
    };
    groupEmailThreadService = { findByGroupAndUser: vi.fn().mockResolvedValue(null) };
    notificationsService = { createNotification: vi.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContributionsService,
        { provide: getRepositoryToken(ContributionRating), useValue: ratingsRepository },
        { provide: getRepositoryToken(Group), useValue: groupsRepository },
        { provide: getRepositoryToken(GroupMember), useValue: membersRepository },
        { provide: getRepositoryToken(Task), useValue: tasksRepository },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: EmailService, useValue: emailService },
        { provide: GroupEmailThreadService, useValue: groupEmailThreadService },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue('http://localhost:5173') } },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<ContributionsService>(ContributionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const groupId = 'gggg-gggg-gggg-gggg';
  const leaderId = 'llll-llll-llll-llll';
  const memberId = 'mmmm-mmmm-mmmm-mmmm';
  const futureDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  describe('openEvaluation — email notifications', () => {
    const activeGroup = { id: groupId, leader_id: leaderId };
    const leaderUser = {
      id: leaderId,
      email: 'leader@test.com',
      full_name: 'Leader',
      notification_enabled: true,
    };
    const memberUser = {
      id: memberId,
      email: 'member@test.com',
      full_name: 'Member',
      notification_enabled: true,
    };
    const eligibleTask = {
      id: 'task-1',
      group_id: groupId,
      assignee_id: memberId,
      status: 'done',
    };

    beforeEach(() => {
      groupsRepository.findOne.mockResolvedValue(activeGroup as Group);
      membersRepository.find.mockResolvedValue([
        { user_id: leaderId, is_active: true } as GroupMember,
        { user_id: memberId, is_active: true } as GroupMember,
      ]);
      membersRepository.findOne.mockResolvedValue({ user_id: leaderId, is_active: true } as GroupMember);
      ratingsRepository.findOne.mockResolvedValue(null);
      ratingsRepository.save.mockResolvedValue([]);
      tasksRepository.find.mockResolvedValue([eligibleTask as Task]);
    });

    it('sends a contribution-open email to every active member', async () => {
      usersRepository.find.mockResolvedValue([leaderUser, memberUser] as User[]);

      await service.openEvaluation(groupId, leaderId, futureDue);

      expect(emailService.sendContributionOpenEmail).toHaveBeenCalledTimes(2);
      expect(emailService.sendContributionOpenEmail).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'leader@test.com' }),
      );
      expect(emailService.sendContributionOpenEmail).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'member@test.com' }),
      );
    });

    it('passes the thread messageId in In-Reply-To when a thread exists for the member', async () => {
      usersRepository.find.mockResolvedValue([memberUser] as User[]);
      groupEmailThreadService.findByGroupAndUser.mockResolvedValue({
        thread_message_id: '<root@ntu-study.local>',
      });

      await service.openEvaluation(groupId, leaderId, futureDue);

      expect(emailService.sendContributionOpenEmail).toHaveBeenCalledWith(
        expect.objectContaining({ threadMessageId: '<root@ntu-study.local>' }),
      );
    });

    it('skips email for members with notifications disabled', async () => {
      usersRepository.find.mockResolvedValue([
        { ...memberUser, notification_enabled: false },
      ] as User[]);

      await service.openEvaluation(groupId, leaderId, futureDue);

      expect(emailService.sendContributionOpenEmail).not.toHaveBeenCalled();
    });

    it('creates ratings for tasks not yet in any previous round', async () => {
      usersRepository.find.mockResolvedValue([leaderUser, memberUser] as User[]);

      const result = await service.openEvaluation(groupId, leaderId, futureDue);

      // leaderUser can rate the task assigned to memberId → 1 rating row expected
      expect(result.ratings_created).toBe(1);
      expect(ratingsRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ rater: { id: leaderId } }),
        ]),
      );
    });

    it('throws when all eligible tasks were already evaluated in a previous round', async () => {
      // Simulate the previous-round query returning the only eligible task
      qbChain.getRawMany.mockResolvedValueOnce([{ taskId: eligibleTask.id }]);
      usersRepository.find.mockResolvedValue([leaderUser, memberUser] as User[]);

      await expect(
        service.openEvaluation(groupId, leaderId, futureDue),
      ).rejects.toThrow('All eligible tasks have already been evaluated in a previous round');
    });
  });

  describe('closeEvaluation — notifications', () => {
    const roundStartedAt = new Date('2026-04-01T00:00:00.000Z');
    const activeGroup = { id: groupId, name: 'Test Group', leader_id: leaderId };
    const memberUser = {
      id: memberId,
      email: 'member@test.com',
      full_name: 'Member',
      notification_enabled: true,
      preferred_language: 'vi',
    };

    beforeEach(() => {
      groupsRepository.findOne.mockResolvedValue(activeGroup as Group);
      membersRepository.find.mockResolvedValue([
        { user_id: memberId, is_active: true } as GroupMember,
      ]);
    });

    it('creates in-app notification and sends email to members with scored tasks', async () => {
      qbChain.execute.mockResolvedValueOnce({ affected: 1 });
      qbChain.getRawMany.mockResolvedValueOnce([
        { task_id: 'task-1', task_title: 'Task One', average_score: '8.50' },
      ]);
      usersRepository.find.mockResolvedValue([memberUser] as User[]);

      await service.closeEvaluation(groupId, leaderId, roundStartedAt);

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipient_id: memberId, type: 'evaluation_closed' }),
      );
      expect(emailService.sendContributionClosedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'member@test.com', overallAverage: 8.5 }),
      );
    });

    it('skips members with no scored tasks', async () => {
      qbChain.execute.mockResolvedValueOnce({ affected: 1 });
      qbChain.getRawMany.mockResolvedValueOnce([]);
      usersRepository.find.mockResolvedValue([memberUser] as User[]);

      await service.closeEvaluation(groupId, leaderId, roundStartedAt);

      expect(notificationsService.createNotification).not.toHaveBeenCalled();
      expect(emailService.sendContributionClosedEmail).not.toHaveBeenCalled();
    });

    it('creates in-app notification but skips email when notifications disabled', async () => {
      qbChain.execute.mockResolvedValueOnce({ affected: 1 });
      qbChain.getRawMany.mockResolvedValueOnce([
        { task_id: 'task-1', task_title: 'Task One', average_score: '7.00' },
      ]);
      usersRepository.find.mockResolvedValue([
        { ...memberUser, notification_enabled: false },
      ] as User[]);

      await service.closeEvaluation(groupId, leaderId, roundStartedAt);

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipient_id: memberId }),
      );
      expect(emailService.sendContributionClosedEmail).not.toHaveBeenCalled();
    });
  });

  describe('parseRoundStartedAt', () => {
    it('should parse a valid ISO date string', () => {
      const isoDate = '2026-05-09T12:00:00.000Z';
      const result = service.parseRoundStartedAt(isoDate);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(isoDate);
    });

    it('should throw for invalid date string', () => {
      expect(() => service.parseRoundStartedAt('invalid')).toThrow(
        BadRequestException,
      );
    });

    it('should decode URI-encoded dates', () => {
      const encoded = encodeURIComponent('2026-05-09T12:00:00.000Z');
      const result = service.parseRoundStartedAt(encoded);
      expect(result).toBeInstanceOf(Date);
    });
  });
});
