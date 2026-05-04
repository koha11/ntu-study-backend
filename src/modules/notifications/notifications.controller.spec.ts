import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: {
    getUserNotifications: ReturnType<typeof vi.fn>;
    markAsRead: ReturnType<typeof vi.fn>;
  };

  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(async () => {
    notificationsService = {
      getUserNotifications: vi.fn(),
      markAsRead: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(NotificationsController);
  });

  it('getUserNotifications passes user id and unread flag when unread=true', async () => {
    notificationsService.getUserNotifications.mockResolvedValue([]);

    await controller.getUserNotifications(
      { user: { id: userId } } as never,
      'true',
    );

    expect(notificationsService.getUserNotifications).toHaveBeenCalledWith(
      userId,
      true,
    );
  });

  it('getUserNotifications passes undefined unread when not set', async () => {
    notificationsService.getUserNotifications.mockResolvedValue([]);

    await controller.getUserNotifications({ user: { id: userId } } as never);

    expect(notificationsService.getUserNotifications).toHaveBeenCalledWith(
      userId,
      undefined,
    );
  });

  it('markAsRead forwards id and user id', async () => {
    const n = { id: 'n1', is_read: true };
    notificationsService.markAsRead.mockResolvedValue(n);

    const result = await controller.markAsRead(
      { user: { id: userId } } as never,
      'n1',
    );

    expect(notificationsService.markAsRead).toHaveBeenCalledWith('n1', userId);
    expect(result).toBe(n);
  });
});
