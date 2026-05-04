import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TasksService } from './tasks.service';
import { Task } from './entities/task.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { TaskStatus } from '@common/enums';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { UsersService } from '@modules/users/users.service';
import { EmailService } from '@common/services/email.service';
import { NOTIFICATION_TYPE } from '@common/constants/notification-types';

describe('TasksService', () => {
  let service: TasksService;
  let tasksRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let membersRepository: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let groupsRepository: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let notificationsService: { createNotification: ReturnType<typeof vi.fn> };
  let usersService: { findOne: ReturnType<typeof vi.fn> };
  let emailService: {
    sendTaskAssignedEmail: ReturnType<typeof vi.fn>;
    sendTaskPendingReviewEmail: ReturnType<typeof vi.fn>;
    sendTaskReviewResultEmail: ReturnType<typeof vi.fn>;
  };
  let configService: { get: ReturnType<typeof vi.fn> };

  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const otherUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const groupId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const taskId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  beforeEach(async () => {
    const qbChain = {
      innerJoin: vi.fn(),
      leftJoin: vi.fn(),
      leftJoinAndSelect: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      orderBy: vi.fn(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    qbChain.innerJoin.mockReturnValue(qbChain);
    qbChain.leftJoin.mockReturnValue(qbChain);
    qbChain.leftJoinAndSelect.mockReturnValue(qbChain);
    qbChain.where.mockReturnValue(qbChain);
    qbChain.andWhere.mockReturnValue(qbChain);
    qbChain.orderBy.mockReturnValue(qbChain);

    tasksRepository = {
      create: vi.fn((dto: Partial<Task>) => ({ ...dto })),
      save: vi.fn((t: Task) => Promise.resolve({ ...t, id: t.id ?? taskId })),
      findOne: vi.fn(),
      find: vi.fn(),
      remove: vi.fn(),
      createQueryBuilder: vi.fn(() => qbChain),
    };

    membersRepository = {
      findOne: vi.fn(),
    };

    groupsRepository = {
      findOne: vi.fn(),
    };

    notificationsService = {
      createNotification: vi.fn().mockResolvedValue({}),
    };

    usersService = {
      findOne: vi.fn(),
    };

    emailService = {
      sendTaskAssignedEmail: vi.fn().mockResolvedValue(true),
      sendTaskPendingReviewEmail: vi.fn().mockResolvedValue(true),
      sendTaskReviewResultEmail: vi.fn().mockResolvedValue(true),
    };

    configService = {
      get: vi.fn().mockReturnValue('http://frontend.test'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: tasksRepository },
        {
          provide: getRepositoryToken(GroupMember),
          useValue: membersRepository,
        },
        { provide: getRepositoryToken(Group), useValue: groupsRepository },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UsersService, useValue: usersService },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(TasksService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('saves personal task with created_by_id and null group_id', async () => {
      const dto = { title: 'My task' };

      const result = await service.create(userId, dto);

      expect(tasksRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My task',
          created_by_id: userId,
          group_id: undefined,
          status: TaskStatus.TODO,
        }),
      );
      expect(tasksRepository.save).toHaveBeenCalled();
      expect(result.id).toBe(taskId);
    });

    it('saves group task when user is active member', async () => {
      membersRepository.findOne.mockResolvedValue({
        id: 'm1',
        group_id: groupId,
        user_id: userId,
        is_active: true,
      });
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        title: 'Group task',
        group_id: groupId,
        created_by_id: userId,
        assignee_id: userId,
      } as Task);
      const dto = { title: 'Group task', group_id: groupId };

      await service.create(userId, dto);

      expect(membersRepository.findOne).toHaveBeenCalledWith({
        where: { group_id: groupId, user_id: userId, is_active: true },
      });
      expect(tasksRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Group task',
          group_id: groupId,
          created_by_id: userId,
        }),
      );
    });

    it('notifies assignee when creating group task for another member', async () => {
      membersRepository.findOne.mockResolvedValue({
        id: 'm1',
        group_id: groupId,
        user_id: userId,
        is_active: true,
      });
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        title: 'Shared',
        group_id: groupId,
        created_by_id: userId,
        assignee_id: otherUserId,
      } as Task);
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        name: 'My Group',
      } as Group);
      usersService.findOne.mockResolvedValue({
        id: otherUserId,
        email: 'o@test.com',
        full_name: 'Other',
        notification_enabled: true,
      });

      await service.create(userId, {
        title: 'Shared',
        group_id: groupId,
        assignee_id: otherUserId,
      });

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_id: otherUserId,
          type: NOTIFICATION_TYPE.TASK_ASSIGNED,
        }),
      );
      expect(emailService.sendTaskAssignedEmail).toHaveBeenCalled();
    });

    it('throws Forbidden when creating group task without membership', async () => {
      membersRepository.findOne.mockResolvedValue(null);
      const dto = { title: 'X', group_id: groupId };

      await expect(service.create(userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('creates subtask inheriting group from parent', async () => {
      const parentId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
      membersRepository.findOne.mockResolvedValue({
        id: 'm1',
        group_id: groupId,
        user_id: userId,
        is_active: true,
      });
      tasksRepository.findOne
        .mockResolvedValueOnce({
          id: parentId,
          group_id: groupId,
          parent_task_id: null,
          created_by_id: userId,
          assignee_id: userId,
        } as Task)
        .mockResolvedValueOnce({
          id: taskId,
          title: 'Sub',
          group_id: groupId,
          parent_task_id: parentId,
        } as Task);

      await service.create(userId, { title: 'Sub', parent_task_id: parentId });

      expect(tasksRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sub',
          group_id: groupId,
          parent_task_id: parentId,
        }),
      );
    });

    it('throws BadRequest when parent is already a subtask', async () => {
      const parentId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
      tasksRepository.findOne.mockResolvedValue({
        id: parentId,
        group_id: groupId,
        parent_task_id: 'other-parent',
        created_by_id: userId,
        assignee_id: userId,
      } as Task);

      await expect(
        service.create(userId, { title: 'Deep', parent_task_id: parentId }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('throws NotFound when task missing', async () => {
      tasksRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(taskId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns task when user has access (personal creator)', async () => {
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        title: 'T',
        group_id: null,
        created_by_id: userId,
        assignee_id: null,
      });

      const t = await service.findOne(taskId, userId);
      expect(t.id).toBe(taskId);
    });

    it('throws Forbidden when stranger views personal task', async () => {
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: null,
        created_by_id: otherUserId,
        assignee_id: null,
      });

      await expect(service.findOne(taskId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findPersonalTasks', () => {
    it('runs query for personal root tasks for user', async () => {
      await service.findPersonalTasks(userId);

      expect(tasksRepository.createQueryBuilder).toHaveBeenCalledWith('t');
      const chain = tasksRepository.createQueryBuilder.mock.results[0]
        ?.value as {
        where: ReturnType<typeof vi.fn>;
        andWhere: ReturnType<typeof vi.fn>;
        orderBy: ReturnType<typeof vi.fn>;
        getMany: ReturnType<typeof vi.fn>;
      };
      expect(chain.where).toHaveBeenCalledWith('t.group_id IS NULL');
      expect(chain.orderBy).toHaveBeenCalledWith('t.created_at', 'DESC');
      expect(chain.getMany).toHaveBeenCalled();
    });
  });

  describe('findGroupTasks', () => {
    it('throws Forbidden when user cannot view group', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: otherUserId,
      });
      membersRepository.findOne.mockResolvedValue(null);

      await expect(service.findGroupTasks(groupId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns tasks for leader without membership row', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: userId,
      });
      tasksRepository.find.mockResolvedValue([{ id: taskId, group_id: groupId }]);

      const list = await service.findGroupTasks(groupId, userId);

      expect(list).toHaveLength(1);
      expect(tasksRepository.find).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFound when task missing', async () => {
      tasksRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(taskId, userId, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('persists title change when user can edit', async () => {
      const existing = {
        id: taskId,
        title: 'Old',
        group_id: null,
        created_by_id: userId,
        assignee_id: null,
        status: TaskStatus.TODO,
      };
      tasksRepository.findOne.mockResolvedValue({ ...existing });
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...existing, ...t }),
      );

      const updated = await service.update(taskId, userId, { title: 'New' });

      expect(updated.title).toBe('New');
      expect(tasksRepository.save).toHaveBeenCalled();
    });

    it('notifies new assignee when group task assignee changes', async () => {
      const existing = {
        id: taskId,
        title: 'T',
        group_id: groupId,
        created_by_id: userId,
        assignee_id: userId,
        status: TaskStatus.TODO,
      };
      const reloaded = {
        ...existing,
        assignee_id: otherUserId,
      };
      tasksRepository.findOne
        .mockResolvedValueOnce({ ...existing })
        .mockResolvedValueOnce(reloaded as Task);
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...existing, ...t }),
      );
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        name: 'G',
      } as Group);
      usersService.findOne.mockResolvedValue({
        id: otherUserId,
        email: 'o@test.com',
        full_name: 'Peer',
        notification_enabled: false,
      });

      await service.update(taskId, userId, { assignee_id: otherUserId });

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_id: otherUserId,
          type: NOTIFICATION_TYPE.TASK_ASSIGNED,
        }),
      );
      expect(emailService.sendTaskAssignedEmail).not.toHaveBeenCalled();
    });

    it('throws BadRequest when group task update sets pending_review via PATCH', async () => {
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        created_by_id: userId,
        assignee_id: userId,
        status: TaskStatus.IN_PROGRESS,
      });

      await expect(
        service.update(taskId, userId, { status: TaskStatus.PENDING_REVIEW }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitTask', () => {
    it('throws when task not in_progress', async () => {
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        status: TaskStatus.TODO,
        assignee_id: userId,
        created_by_id: otherUserId,
      });

      await expect(service.submitTask(taskId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('sets pending_review and submitted_at', async () => {
      const existing = {
        id: taskId,
        group_id: groupId,
        status: TaskStatus.IN_PROGRESS,
        assignee_id: userId,
        created_by_id: otherUserId,
      };
      const afterSubmit = {
        ...existing,
        status: TaskStatus.PENDING_REVIEW,
        submitted_at: new Date(),
      };
      tasksRepository.findOne
        .mockResolvedValueOnce({ ...existing })
        .mockResolvedValueOnce(afterSubmit as Task);
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...existing, ...t }),
      );
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: otherUserId,
        name: 'Team',
      } as Group);
      usersService.findOne.mockImplementation((id: string) => {
        if (id === otherUserId) {
          return Promise.resolve({
            id: otherUserId,
            email: 'lead@test.com',
            full_name: 'Leader',
            notification_enabled: true,
          });
        }
        if (id === userId) {
          return Promise.resolve({
            id: userId,
            email: 'u@test.com',
            full_name: 'Worker',
            notification_enabled: true,
          });
        }
        return Promise.resolve(null);
      });

      const result = await service.submitTask(taskId, userId);

      expect(result.status).toBe(TaskStatus.PENDING_REVIEW);
      expect(result.submitted_at).toBeInstanceOf(Date);
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NOTIFICATION_TYPE.TASK_PENDING_REVIEW,
        }),
      );
      expect(emailService.sendTaskPendingReviewEmail).toHaveBeenCalled();
    });
  });

  describe('approveTask', () => {
    it('throws Forbidden when user is not leader', async () => {
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        status: TaskStatus.PENDING_REVIEW,
      });
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: otherUserId,
      });

      await expect(
        service.approveTask(taskId, userId, TaskStatus.DONE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sets done and reviewed fields for leader', async () => {
      const existing = {
        id: taskId,
        group_id: groupId,
        status: TaskStatus.PENDING_REVIEW,
        assignee_id: otherUserId,
      };
      const reviewed = {
        ...existing,
        status: TaskStatus.DONE,
        reviewed_at: new Date(),
        reviewed_by_id: userId,
      };
      tasksRepository.findOne
        .mockResolvedValueOnce({ ...existing })
        .mockResolvedValueOnce(reviewed as Task);
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: userId,
        name: 'Team',
      } as Group);
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...existing, ...t }),
      );
      usersService.findOne.mockResolvedValue({
        id: otherUserId,
        email: 'a@test.com',
        full_name: 'Assignee',
        notification_enabled: true,
      });

      const result = await service.approveTask(taskId, userId, TaskStatus.DONE);

      expect(result.status).toBe(TaskStatus.DONE);
      expect(result.reviewed_by_id).toBe(userId);
      expect(result.reviewed_at).toBeInstanceOf(Date);
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_id: otherUserId,
          type: NOTIFICATION_TYPE.TASK_REVIEW_RESULT,
        }),
      );
      expect(emailService.sendTaskReviewResultEmail).toHaveBeenCalled();
    });
  });

  describe('deleteTask', () => {
    it('calls repository.remove', async () => {
      const existing = {
        id: taskId,
        group_id: null,
        created_by_id: userId,
      };
      tasksRepository.findOne.mockResolvedValue(existing);

      await service.deleteTask(taskId, userId);

      expect(tasksRepository.remove).toHaveBeenCalledWith(existing);
    });
  });
});
