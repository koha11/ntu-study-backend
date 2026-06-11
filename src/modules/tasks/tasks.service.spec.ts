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
import { GroupEmailThreadService } from '@common/services/group-email-thread.service';
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
  let groupEmailThreadService: { findByGroupAndUser: ReturnType<typeof vi.fn> };

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

    groupEmailThreadService = {
      findByGroupAndUser: vi.fn().mockResolvedValue(null),
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
        { provide: GroupEmailThreadService, useValue: groupEmailThreadService },
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
      tasksRepository.find.mockResolvedValue([
        { id: taskId, group_id: groupId },
      ]);

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

  describe('findOverdueTasks', () => {
    it('returns tasks with past due dates that are not done', async () => {
      const qb = tasksRepository.createQueryBuilder();
      qb.getMany.mockResolvedValue([
        { id: taskId, title: 'Overdue', due_date: new Date('2020-01-01') },
      ]);

      const result = await service.findOverdueTasks();

      expect(result).toHaveLength(1);
      expect(tasksRepository.createQueryBuilder).toHaveBeenCalled();
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

  // -------------------------------------------------------------------------
  // Notification helper edge cases
  // -------------------------------------------------------------------------

  describe('create — notification side-effects', () => {
    it('skips notification when assignee is the same as the creator (self-assignment)', async () => {
      membersRepository.findOne.mockResolvedValue({
        group_id: groupId,
        user_id: userId,
      });
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...t, id: taskId }),
      );
      // Reload returns task with group+assignee same as creator
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        assignee_id: userId,
        created_by_id: userId,
        title: 'T',
        status: TaskStatus.TODO,
        assignee: { id: userId, email: 'u@t.com' },
        parent_task: null,
        subtasks: [],
      });

      await service.create(userId, {
        title: 'T',
        group_id: groupId,
        assignee_id: userId,
      });

      // Self-assignment → no notification
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('sends notification when assigned to a different member', async () => {
      membersRepository.findOne.mockResolvedValue({
        group_id: groupId,
        user_id: userId,
      });
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...t, id: taskId }),
      );
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        assignee_id: otherUserId,
        created_by_id: userId,
        title: 'T',
        status: TaskStatus.TODO,
        assignee: { id: otherUserId, email: 'other@t.com' },
        parent_task: null,
        subtasks: [],
      });
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        name: 'Group',
        leader_id: userId,
      } as Group);
      usersService.findOne.mockResolvedValue({
        id: otherUserId,
        email: 'other@t.com',
        full_name: 'Other',
        notification_enabled: true,
        preferred_language: 'en',
      });
      groupEmailThreadService.findByGroupAndUser.mockResolvedValue(null);

      await service.create(userId, {
        title: 'T',
        group_id: groupId,
        assignee_id: otherUserId,
      });

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipient_id: otherUserId }),
      );
    });

    it('skips email notification when assignee has notifications disabled', async () => {
      membersRepository.findOne.mockResolvedValue({
        group_id: groupId,
        user_id: userId,
      });
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...t, id: taskId }),
      );
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        assignee_id: otherUserId,
        created_by_id: userId,
        title: 'T',
        status: TaskStatus.TODO,
        assignee: { id: otherUserId },
        parent_task: null,
        subtasks: [],
      });
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        name: 'Group',
        leader_id: userId,
      } as Group);
      usersService.findOne.mockResolvedValue({
        id: otherUserId,
        email: 'other@t.com',
        full_name: 'Other',
        notification_enabled: false,
        preferred_language: 'en',
      });

      await service.create(userId, {
        title: 'T',
        group_id: groupId,
        assignee_id: otherUserId,
      });

      // In-app created but email skipped
      expect(notificationsService.createNotification).toHaveBeenCalled();
      expect(emailService.sendTaskAssignedEmail).not.toHaveBeenCalled();
    });
  });

  describe('submitTask — leader not found', () => {
    it('skips notification if group not found', async () => {
      tasksRepository.findOne
        .mockResolvedValueOnce({
          id: taskId,
          group_id: groupId,
          status: TaskStatus.IN_PROGRESS,
          assignee_id: userId,
          created_by_id: userId,
        })
        .mockResolvedValueOnce({
          id: taskId,
          group_id: groupId,
          status: TaskStatus.PENDING_REVIEW,
          submitted_at: new Date(),
          assignee_id: userId,
          created_by_id: userId,
        });
      tasksRepository.save.mockImplementation((t: Task) => Promise.resolve(t));
      groupsRepository.findOne.mockResolvedValue(null);

      const result = await service.submitTask(taskId, userId);

      expect(result.status).toBe(TaskStatus.PENDING_REVIEW);
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // assertCanEditTask edge cases (lines 575, 587)
  // -------------------------------------------------------------------------
  describe('update — assertCanEditTask edge cases', () => {
    it('throws ForbiddenException when personal task owner is neither creator nor assignee', async () => {
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: null,
        created_by_id: otherUserId,
        assignee_id: otherUserId,
        status: TaskStatus.TODO,
      });

      await expect(
        service.update(taskId, userId, { title: 'New title' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when group task user is not leader/creator/assignee', async () => {
      const outsiderId = 'eeee-eeee-eeee-eeee-eeeeeeeeeeee';
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        created_by_id: otherUserId,
        assignee_id: otherUserId,
        status: TaskStatus.TODO,
      });
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: otherUserId,
      } as Group);

      await expect(
        service.update(taskId, outsiderId, { title: 'Nope' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -------------------------------------------------------------------------
  // assertCanViewGroup edge cases (line 549)
  // -------------------------------------------------------------------------
  describe('findGroupTasks — assertCanViewGroup group not found', () => {
    it('throws NotFoundException when group does not exist', async () => {
      groupsRepository.findOne.mockResolvedValue(null);
      const qb = tasksRepository.createQueryBuilder();

      await expect(service.findGroupTasks(groupId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Vietnamese language branch coverage in notification helpers
  // -------------------------------------------------------------------------
  describe('submitTask — Vietnamese leader notification', () => {
    it('sends Vietnamese notification when leader preferred_language is vi', async () => {
      const viLeaderId = 'vivi-vivi-vivi-vivi-vivivivivivi';
      const existing = {
        id: taskId,
        group_id: groupId,
        status: TaskStatus.IN_PROGRESS,
        assignee_id: userId,
        created_by_id: userId,
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
        leader_id: viLeaderId,
        name: 'Nhóm học',
      } as Group);
      usersService.findOne.mockImplementation((id: string) => {
        if (id === viLeaderId)
          return Promise.resolve({
            id: viLeaderId,
            email: 'leader@t.com',
            full_name: 'Trưởng nhóm',
            notification_enabled: true,
            preferred_language: 'vi',
          });
        if (id === userId)
          return Promise.resolve({
            id: userId,
            email: 'u@t.com',
            full_name: 'Thành viên',
            notification_enabled: true,
            preferred_language: 'vi',
          });
        return Promise.resolve(null);
      });
      groupEmailThreadService.findByGroupAndUser.mockResolvedValue(null);

      await service.submitTask(taskId, userId);

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipient_id: viLeaderId }),
      );
    });
  });

  describe('approveTask — Vietnamese assignee notification', () => {
    it('sends Vietnamese notification when assignee preferred_language is vi', async () => {
      const viAssigneeId = 'vvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv';
      const existing = {
        id: taskId,
        group_id: groupId,
        status: TaskStatus.PENDING_REVIEW,
        assignee_id: viAssigneeId,
      };
      const reviewed = {
        ...existing,
        status: TaskStatus.FAILED,
        reviewed_at: new Date(),
        reviewed_by_id: userId,
      };
      tasksRepository.findOne
        .mockResolvedValueOnce({ ...existing })
        .mockResolvedValueOnce(reviewed as Task);
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: userId,
        name: 'Nhóm học',
      } as Group);
      tasksRepository.save.mockImplementation((t: Task) => Promise.resolve(t));
      usersService.findOne.mockResolvedValue({
        id: viAssigneeId,
        email: 'assignee@t.com',
        full_name: 'Thành viên',
        notification_enabled: true,
        preferred_language: 'vi',
      });

      await service.approveTask(
        taskId,
        userId,
        TaskStatus.FAILED,
        'Chưa đạt yêu cầu',
      );

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ recipient_id: viAssigneeId }),
      );
      expect(emailService.sendTaskReviewResultEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failed',
          comment: 'Chưa đạt yêu cầu',
        }),
      );
    });
  });

  // sendAssigneeTaskAssigned — editor IS the new assignee (line 382)
  describe('update — editor assigns task to themselves (sendAssigneeTaskAssigned early return)', () => {
    it('does not notify when editor reassigns the task to themselves', async () => {
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        created_by_id: userId,
        assignee_id: otherUserId,
        status: TaskStatus.TODO,
      });
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...t, id: taskId }),
      );
      groupsRepository.findOne
        .mockResolvedValueOnce({ id: groupId, leader_id: userId }) // assertCanEditTask
        .mockResolvedValueOnce({ id: groupId, leader_id: userId, name: 'G' }); // sendAssigneeTaskAssigned

      // Change assignee from otherUserId to userId (editor is now the assignee)
      await service.update(taskId, userId, { assignee_id: userId });

      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  // sendAssigneeTaskAssigned — group not found (line 388)
  describe('update — group not found in sendAssigneeTaskAssigned', () => {
    it('silently skips notification when group not found during notification', async () => {
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        created_by_id: userId,
        assignee_id: userId, // currently assigned to creator
        status: TaskStatus.TODO,
      });
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...t, id: taskId }),
      );
      groupsRepository.findOne
        .mockResolvedValueOnce({ id: groupId, leader_id: userId }) // assertCanEditTask pass
        .mockResolvedValueOnce(null); // sendAssigneeTaskAssigned: group not found

      // Change assignee from userId to otherUserId (new assignment)
      await service.update(taskId, userId, { assignee_id: otherUserId });

      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  // sendAssigneeTaskAssigned — assignee not found (line 392)
  describe('create — assignee not found after group lookup', () => {
    it('skips notification when usersService.findOne returns null for assignee', async () => {
      membersRepository.findOne.mockResolvedValue({
        group_id: groupId,
        user_id: userId,
      });
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...t, id: taskId }),
      );
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        assignee_id: otherUserId,
        created_by_id: userId,
        title: 'T',
        status: TaskStatus.TODO,
        assignee: { id: otherUserId },
        parent_task: null,
        subtasks: [],
      });
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        name: 'G',
        leader_id: userId,
      } as Group);
      usersService.findOne.mockResolvedValue(null);

      await service.create(userId, {
        title: 'T',
        group_id: groupId,
        assignee_id: otherUserId,
      });

      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  // maybeNotifyAssigneeChange — same assignee (line 427)
  describe('update — same assignee does not trigger notification', () => {
    it('skips notification when assignee has not changed', async () => {
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        created_by_id: userId,
        assignee_id: otherUserId,
        status: TaskStatus.TODO,
      });
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...t, id: taskId }),
      );
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: userId,
      } as Group);

      await service.update(taskId, userId, { assignee_id: otherUserId });

      // Same assignee → no notification
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  // sendAssigneeTaskAssigned — editor is the new assignee (line 437)
  describe('update — self-assignment triggers no notification', () => {
    it('does not notify when editor assigns the task to themselves', async () => {
      tasksRepository.findOne.mockResolvedValue({
        id: taskId,
        group_id: groupId,
        created_by_id: userId,
        assignee_id: userId,
        status: TaskStatus.TODO,
      });
      tasksRepository.save.mockImplementation((t: Task) =>
        Promise.resolve({ ...t, id: taskId }),
      );
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: userId,
      } as Group);

      // Assign task to themselves (same as editor)
      await service.update(taskId, userId, { assignee_id: userId });

      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  // assertCanAccessTask — group task path (line 569)
  describe('findOne — group task accessible by member', () => {
    it('returns group task when user is an active member (not leader)', async () => {
      const memberId = 'memm-memm-memm-memm-memmmmmmmmm';
      tasksRepository.findOne.mockResolvedValueOnce({
        id: taskId,
        group_id: groupId,
        created_by_id: userId,
        assignee_id: userId,
        status: TaskStatus.TODO,
        parent_task: null,
        subtasks: [],
      });
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: userId,
      } as Group);
      membersRepository.findOne.mockResolvedValue({
        group_id: groupId,
        user_id: memberId,
        is_active: true,
      });

      const result = await service.findOne(taskId, memberId);

      expect(result.id).toBe(taskId);
    });
  });

  describe('assertCanViewGroup — leader bypass', () => {
    it('allows group leader to view group tasks without membership check', async () => {
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: userId,
      } as Group);
      const qb = tasksRepository.createQueryBuilder();

      await service.findGroupTasks(groupId, userId);

      // If leader, assertCanViewGroup returns early without checking membership
      expect(membersRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('approveTask — assignee not found', () => {
    it('skips notification if assignee user not found', async () => {
      const existing = {
        id: taskId,
        group_id: groupId,
        status: TaskStatus.PENDING_REVIEW,
        assignee_id: otherUserId,
      };
      tasksRepository.findOne
        .mockResolvedValueOnce({ ...existing })
        .mockResolvedValueOnce({
          ...existing,
          status: TaskStatus.DONE,
          reviewed_by_id: userId,
        });
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: userId,
        name: 'Team',
      } as Group);
      tasksRepository.save.mockImplementation((t: Task) => Promise.resolve(t));
      usersService.findOne.mockResolvedValue(null);

      const result = await service.approveTask(taskId, userId, TaskStatus.DONE);

      expect(result.status).toBe(TaskStatus.DONE);
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('approveTask — notification branches', () => {
    const setupApprove = (
      status: TaskStatus,
      assigneeLang: string,
      notifEnabled: boolean,
      comment?: string,
    ) => {
      const existing = {
        id: taskId,
        group_id: groupId,
        status: TaskStatus.PENDING_REVIEW,
        assignee_id: otherUserId,
      };
      tasksRepository.findOne
        .mockResolvedValueOnce({ ...existing })
        .mockResolvedValueOnce({
          ...existing,
          status,
          reviewed_by_id: userId,
        } as Task);
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: userId,
        name: 'Group',
      } as Group);
      tasksRepository.save.mockImplementation((t: Task) => Promise.resolve(t));
      usersService.findOne.mockResolvedValue({
        id: otherUserId,
        email: 'a@t.com',
        full_name: 'Assignee',
        notification_enabled: notifEnabled,
        preferred_language: assigneeLang,
      });
      groupEmailThreadService.findByGroupAndUser.mockResolvedValue(null);
    };

    it('sends DONE notification in EN with notifications enabled', async () => {
      setupApprove(TaskStatus.DONE, 'en', true);
      await service.approveTask(taskId, userId, TaskStatus.DONE);
      expect(emailService.sendTaskReviewResultEmail).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'done', lang: 'en' }),
      );
    });

    it('sends FAILED notification in VI with comment when language is vi', async () => {
      setupApprove(TaskStatus.FAILED, 'vi', true, 'needs improvement');
      await service.approveTask(
        taskId,
        userId,
        TaskStatus.FAILED,
        'needs improvement',
      );
      expect(emailService.sendTaskReviewResultEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failed',
          lang: 'vi',
          comment: 'needs improvement',
        }),
      );
    });

    it('creates in-app notification but skips email when notifications disabled', async () => {
      setupApprove(TaskStatus.DONE, 'en', false);
      await service.approveTask(taskId, userId, TaskStatus.DONE);
      expect(notificationsService.createNotification).toHaveBeenCalled();
      expect(emailService.sendTaskReviewResultEmail).not.toHaveBeenCalled();
    });

    it('skips notification when task has no assignee_id', async () => {
      const noAssignee = {
        id: taskId,
        group_id: groupId,
        status: TaskStatus.PENDING_REVIEW,
        assignee_id: null,
      };
      tasksRepository.findOne
        .mockResolvedValueOnce({ ...noAssignee })
        .mockResolvedValueOnce({
          ...noAssignee,
          status: TaskStatus.DONE,
          reviewed_by_id: userId,
        } as unknown as Task);
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: userId,
        name: 'G',
      } as Group);
      tasksRepository.save.mockImplementation((t: Task) => Promise.resolve(t));

      await service.approveTask(taskId, userId, TaskStatus.DONE);
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('submitTask — leader notification branches', () => {
    it('skips pending-review email when leader notifications are disabled', async () => {
      const existing = {
        id: taskId,
        group_id: groupId,
        status: TaskStatus.IN_PROGRESS,
        assignee_id: userId,
        created_by_id: userId,
      };
      tasksRepository.findOne
        .mockResolvedValueOnce({ ...existing })
        .mockResolvedValueOnce({
          ...existing,
          status: TaskStatus.PENDING_REVIEW,
          submitted_at: new Date(),
        });
      tasksRepository.save.mockImplementation((t: Task) => Promise.resolve(t));
      groupsRepository.findOne.mockResolvedValue({
        id: groupId,
        leader_id: otherUserId,
        name: 'Group',
      } as Group);
      usersService.findOne.mockImplementation((id: string) => {
        if (id === otherUserId)
          return Promise.resolve({
            id: otherUserId,
            email: 'leader@t.com',
            full_name: 'Leader',
            notification_enabled: false,
            preferred_language: 'en',
          });
        return Promise.resolve({
          id: userId,
          full_name: 'User',
          preferred_language: 'en',
        });
      });

      await service.submitTask(taskId, userId);

      expect(notificationsService.createNotification).toHaveBeenCalled();
      expect(emailService.sendTaskPendingReviewEmail).not.toHaveBeenCalled();
    });
  });
});
