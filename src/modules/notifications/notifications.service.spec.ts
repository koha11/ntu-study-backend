import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { NotificationDeliveryChannel } from '@common/enums';
import { NOTIFICATION_TYPE, RELATED_ENTITY_TYPE } from '@common/constants/notification-types';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
  };

  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const otherUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const notifId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  beforeEach(async () => {
    repository = {
      create: vi.fn((dto: Partial<Notification>) => ({ ...dto })),
      save: vi.fn((n: Notification) =>
        Promise.resolve({ ...n, id: n.id ?? notifId }),
      ),
      findOne: vi.fn(),
      find: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createNotification', () => {
    it('persists notification with web channel and optional related entity', async () => {
      const row = await service.createNotification({
        recipient_id: userId,
        type: NOTIFICATION_TYPE.TASK_ASSIGNED,
        message: 'You were assigned a task',
        related_entity_type: RELATED_ENTITY_TYPE.TASK,
        related_entity_id: 'task-uuid',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_id: userId,
          type: NOTIFICATION_TYPE.TASK_ASSIGNED,
          message: 'You were assigned a task',
          related_entity_type: RELATED_ENTITY_TYPE.TASK,
          related_entity_id: 'task-uuid',
          is_read: false,
          delivery_channel: NotificationDeliveryChannel.WEB,
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(row.id).toBe(notifId);
    });
  });

  describe('getUserNotifications', () => {
    it('returns notifications for user ordered by created_at desc', async () => {
      const older = {
        id: '1',
        recipient_id: userId,
        created_at: new Date('2026-01-01'),
      } as Notification;
      const newer = {
        id: '2',
        recipient_id: userId,
        created_at: new Date('2026-01-02'),
      } as Notification;
      repository.find.mockResolvedValue([newer, older]);

      const result = await service.getUserNotifications(userId);

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipient_id: userId },
          order: { created_at: 'DESC' },
        }),
      );
      expect(result).toEqual([newer, older]);
    });

    it('filters unread when unreadOnly is true', async () => {
      repository.find.mockResolvedValue([]);

      await service.getUserNotifications(userId, true);

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipient_id: userId, is_read: false },
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('sets is_read and returns notification when owner matches', async () => {
      const existing = {
        id: notifId,
        recipient_id: userId,
        is_read: false,
      } as Notification;
      repository.findOne.mockResolvedValue(existing);
      repository.save.mockImplementation((n: Notification) =>
        Promise.resolve(n),
      );

      const result = await service.markAsRead(notifId, userId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: notifId },
      });
      expect(existing.is_read).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(existing);
      expect(result.is_read).toBe(true);
    });

    it('throws NotFoundException when notification missing', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.markAsRead(notifId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when recipient does not match', async () => {
      repository.findOne.mockResolvedValue({
        id: notifId,
        recipient_id: otherUserId,
        is_read: false,
      } as Notification);

      await expect(service.markAsRead(notifId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
