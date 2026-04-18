import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
  ) {}

  async createNotification(
    _notificationData: Partial<Notification>,
  ): Promise<Notification> {
    // TODO: Create notification
    throw new Error('Not implemented');
  }

  async getUserNotifications(
    _userId: string,
    _unreadOnly?: boolean,
  ): Promise<Notification[]> {
    // TODO: Get user notifications
    return [];
  }

  async markAsRead(_id: string): Promise<Notification> {
    // TODO: Mark notification as read
    throw new Error('Not implemented');
  }

  async sendEmailNotification(
    _userId: string,
    _subject: string,
    _message: string,
  ): Promise<void> {
    // TODO: Send email notification
  }

  async sendTaskReminders(): Promise<void> {
    // TODO: Send overdue task reminders (cron job)
  }
}
