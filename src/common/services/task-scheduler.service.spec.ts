import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TaskSchedulerService } from './task-scheduler.service';
import { Task } from '../../modules/tasks/entities/task.entity';
import { User } from '../../modules/users/entities/user.entity';
import { Notification } from '../../modules/notifications/entities/notification.entity';
import { CronJobRun } from '../../modules/cron-jobs/entities/cron-job-run.entity';
import { EmailService } from './email.service';
import { GroupEmailThreadService } from './group-email-thread.service';
import { TaskStatus } from '../enums/task-status.enum';
import { CronJobRunStatus, CronJobTrigger } from '../enums';
import { CRON_JOB_NAMES } from '../constants/cron-job-names';

describe('TaskSchedulerService', () => {
  let service: TaskSchedulerService;
  let tasksRepository: {
    find: ReturnType<typeof vi.fn>;
  };
  let usersRepository: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let notificationsRepository: {
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let cronJobRunsRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let emailService: {
    sendBatchedTaskReminderEmail: ReturnType<typeof vi.fn>;
  };
  let groupEmailThreadService: {
    findByGroupAndUser: ReturnType<typeof vi.fn>;
  };

  const userId = 'user-1111-1111-1111-111111111111';
  const groupId = 'group-222-2222-2222-222222222222';

  const makeUser = (overrides: Partial<User> = {}): User =>
    ({
      id: userId,
      email: 'user@test.com',
      full_name: 'Test User',
      notification_enabled: true,
      preferred_language: 'en',
      ...overrides,
    }) as User;

  const makeTask = (overrides: Partial<Task> = {}): Task =>
    ({
      id: 'task-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Overdue Task',
      status: TaskStatus.TODO,
      due_date: new Date('2020-01-01'),
      assignee: makeUser(),
      assignee_id: userId,
      group_id: null,
      group: null,
      ...overrides,
    }) as Task;

  beforeEach(async () => {
    tasksRepository = { find: vi.fn().mockResolvedValue([]) };
    usersRepository = { findOne: vi.fn().mockResolvedValue(null) };
    notificationsRepository = {
      save: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({ affected: 5 }),
    };
    cronJobRunsRepository = {
      create: vi.fn((d: unknown) => d),
      save: vi.fn().mockResolvedValue({}),
    };
    emailService = {
      sendBatchedTaskReminderEmail: vi.fn().mockResolvedValue(undefined),
    };
    groupEmailThreadService = {
      findByGroupAndUser: vi.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskSchedulerService,
        { provide: getRepositoryToken(Task), useValue: tasksRepository },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        {
          provide: getRepositoryToken(Notification),
          useValue: notificationsRepository,
        },
        {
          provide: getRepositoryToken(CronJobRun),
          useValue: cronJobRunsRepository,
        },
        { provide: EmailService, useValue: emailService },
        { provide: GroupEmailThreadService, useValue: groupEmailThreadService },
      ],
    }).compile();

    service = module.get<TaskSchedulerService>(TaskSchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runJobBySlug', () => {
    it('throws NotFoundException for unknown slug', async () => {
      await expect(service.runJobBySlug('nonexistent-job')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('runs overdue task reminders job by slug', async () => {
      tasksRepository.find.mockResolvedValue([]);
      await expect(
        service.runJobBySlug(CRON_JOB_NAMES.OVERDUE_TASK_REMINDERS),
      ).resolves.toBeUndefined();
      expect(cronJobRunsRepository.save).toHaveBeenCalled();
    });

    it('runs cleanup old notifications job by slug', async () => {
      await expect(
        service.runJobBySlug(CRON_JOB_NAMES.CLEANUP_OLD_NOTIFICATIONS),
      ).resolves.toBeUndefined();
      expect(notificationsRepository.delete).toHaveBeenCalled();
    });
  });

  describe('executeOverdueTaskReminders (via sendOverdueTaskReminders)', () => {
    it('does nothing when there are no overdue tasks', async () => {
      tasksRepository.find.mockResolvedValue([]);

      await service.sendOverdueTaskReminders();

      expect(usersRepository.findOne).not.toHaveBeenCalled();
      expect(emailService.sendBatchedTaskReminderEmail).not.toHaveBeenCalled();
    });

    it('records SUCCESS status when job completes without error', async () => {
      tasksRepository.find.mockResolvedValue([]);

      await service.sendOverdueTaskReminders();

      const savedRun = cronJobRunsRepository.save.mock.calls[1]?.[0];
      expect(savedRun?.status).toBe(CronJobRunStatus.SUCCESS);
    });

    it('records FAILURE status and captures error message when job throws', async () => {
      tasksRepository.find.mockRejectedValue(new Error('DB connection failed'));

      await service.sendOverdueTaskReminders();

      const savedRun = cronJobRunsRepository.save.mock.calls[1]?.[0];
      expect(savedRun?.status).toBe(CronJobRunStatus.FAILURE);
      expect(savedRun?.error_message).toContain('DB connection failed');
    });

    it('skips tasks without assignee', async () => {
      const taskWithoutAssignee = makeTask({
        assignee: null as unknown as User,
        assignee_id: null as unknown as string,
      });
      tasksRepository.find.mockResolvedValue([taskWithoutAssignee]);

      await service.sendOverdueTaskReminders();

      expect(usersRepository.findOne).not.toHaveBeenCalled();
      expect(emailService.sendBatchedTaskReminderEmail).not.toHaveBeenCalled();
    });

    it('creates in-app notification for each overdue task', async () => {
      const user = makeUser();
      const task = makeTask();
      tasksRepository.find.mockResolvedValue([task]);
      usersRepository.findOne.mockResolvedValue(user);

      await service.sendOverdueTaskReminders();

      expect(notificationsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_id: userId,
          type: 'Task Overdue',
          is_read: false,
        }),
      );
    });

    it('sends email for personal overdue tasks when notifications enabled', async () => {
      const user = makeUser({ notification_enabled: true });
      const task = makeTask({
        group_id: null,
        due_date: new Date('2020-01-01'),
      });
      tasksRepository.find.mockResolvedValue([task]);
      usersRepository.findOne.mockResolvedValue(user);

      await service.sendOverdueTaskReminders();

      expect(emailService.sendBatchedTaskReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: user.email,
          groupName: 'Personal Tasks',
        }),
      );
    });

    it('sends email in Vietnamese when user preferred_language is not en', async () => {
      const user = makeUser({
        notification_enabled: true,
        preferred_language: 'vi',
      });
      const task = makeTask({ due_date: new Date('2020-01-01') });
      tasksRepository.find.mockResolvedValue([task]);
      usersRepository.findOne.mockResolvedValue(user);

      await service.sendOverdueTaskReminders();

      expect(emailService.sendBatchedTaskReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({ groupName: 'Nhiệm vụ cá nhân' }),
      );
    });

    it('skips email when user notifications are disabled but still creates in-app notification', async () => {
      const user = makeUser({ notification_enabled: false });
      const task = makeTask({ due_date: new Date('2020-01-01') });
      tasksRepository.find.mockResolvedValue([task]);
      usersRepository.findOne.mockResolvedValue(user);

      await service.sendOverdueTaskReminders();

      expect(notificationsRepository.save).toHaveBeenCalled();
      expect(emailService.sendBatchedTaskReminderEmail).not.toHaveBeenCalled();
    });

    it('sends group thread email for group tasks', async () => {
      const user = makeUser({ notification_enabled: true });
      const task = makeTask({
        group_id: groupId,
        group: { id: groupId, name: 'Test Group' } as Task['group'],
        due_date: new Date('2020-01-01'),
      });
      tasksRepository.find.mockResolvedValue([task]);
      usersRepository.findOne.mockResolvedValue(user);
      groupEmailThreadService.findByGroupAndUser.mockResolvedValue({
        thread_message_id: '<root@ntu-study.local>',
      });

      await service.sendOverdueTaskReminders();

      expect(emailService.sendBatchedTaskReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          groupName: 'Test Group',
          threadMessageId: '<root@ntu-study.local>',
        }),
      );
    });

    it('sends group email without thread if no thread exists', async () => {
      const user = makeUser({ notification_enabled: true });
      const task = makeTask({
        group_id: groupId,
        group: { id: groupId, name: 'Study Group' } as Task['group'],
        due_date: new Date('2020-01-01'),
      });
      tasksRepository.find.mockResolvedValue([task]);
      usersRepository.findOne.mockResolvedValue(user);
      groupEmailThreadService.findByGroupAndUser.mockResolvedValue(null);

      await service.sendOverdueTaskReminders();

      expect(emailService.sendBatchedTaskReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          groupName: 'Study Group',
          threadMessageId: undefined,
        }),
      );
    });

    it('skips user entirely if not found in database', async () => {
      const task = makeTask();
      tasksRepository.find.mockResolvedValue([task]);
      usersRepository.findOne.mockResolvedValue(null);

      await service.sendOverdueTaskReminders();

      expect(emailService.sendBatchedTaskReminderEmail).not.toHaveBeenCalled();
      expect(notificationsRepository.save).not.toHaveBeenCalled();
    });

    it('uses CRON trigger when called from cron schedule', async () => {
      tasksRepository.find.mockResolvedValue([]);

      await service.sendOverdueTaskReminders();

      const createdRun = cronJobRunsRepository.create.mock.calls[0]?.[0];
      expect(createdRun?.triggered_by).toBe(CronJobTrigger.CRON);
    });

    it('uses MANUAL trigger when called via runJobBySlug', async () => {
      tasksRepository.find.mockResolvedValue([]);

      await service.runJobBySlug(CRON_JOB_NAMES.OVERDUE_TASK_REMINDERS);

      const createdRun = cronJobRunsRepository.create.mock.calls[0]?.[0];
      expect(createdRun?.triggered_by).toBe(CronJobTrigger.MANUAL);
    });

    it('truncates error messages longer than 8000 chars', async () => {
      const longError = new Error('x'.repeat(9000));
      tasksRepository.find.mockRejectedValue(longError);

      await service.sendOverdueTaskReminders();

      const savedRun = cronJobRunsRepository.save.mock.calls[1]?.[0];
      expect(savedRun?.error_message?.length).toBeLessThanOrEqual(8001);
      expect(savedRun?.error_message).toMatch(/…$/);
    });
  });

  describe('executeCleanupOldNotifications (via cleanupOldNotifications)', () => {
    it('deletes read notifications older than 30 days', async () => {
      notificationsRepository.delete.mockResolvedValue({ affected: 10 });

      await service.cleanupOldNotifications();

      expect(notificationsRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({ is_read: true }),
      );
    });

    it('records SUCCESS when cleanup finishes', async () => {
      notificationsRepository.delete.mockResolvedValue({ affected: 3 });

      await service.cleanupOldNotifications();

      const savedRun = cronJobRunsRepository.save.mock.calls[1]?.[0];
      expect(savedRun?.status).toBe(CronJobRunStatus.SUCCESS);
    });

    it('records FAILURE when delete throws', async () => {
      notificationsRepository.delete.mockRejectedValue(new Error('DB error'));

      await service.cleanupOldNotifications();

      const savedRun = cronJobRunsRepository.save.mock.calls[1]?.[0];
      expect(savedRun?.status).toBe(CronJobRunStatus.FAILURE);
    });
  });
});
