import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationDeliveryChannel } from '@common/enums';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
  ) {}

  async createNotification(
    data: Pick<Notification, 'recipient_id' | 'type' | 'message'> &
      Partial<
        Pick<
          Notification,
          'related_entity_type' | 'related_entity_id' | 'delivery_channel'
        >
      >,
  ): Promise<Notification> {
    this.logger.log(
      `Creating notification for ${data.recipient_id}: type=${data.type}`,
    );
    const notification = this.notificationsRepository.create({
      recipient_id: data.recipient_id,
      type: data.type,
      message: data.message,
      related_entity_type: data.related_entity_type,
      related_entity_id: data.related_entity_id,
      is_read: false,
      delivery_channel:
        data.delivery_channel ?? NotificationDeliveryChannel.WEB,
    });
    return this.notificationsRepository.save(notification);
  }

  async getUserNotifications(
    userId: string,
    unreadOnly?: boolean,
  ): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: unreadOnly
        ? { recipient_id: userId, is_read: false }
        : { recipient_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { recipient_id: userId, is_read: false },
      { is_read: true },
    );
    this.logger.log(`All notifications marked as read for user ${userId}`);
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
    });
    if (!notification || notification.recipient_id !== userId) {
      throw new NotFoundException('Notification not found');
    }
    notification.is_read = true;
    this.logger.log(`Notification ${id} marked as read for user ${userId}`);
    return this.notificationsRepository.save(notification);
  }
}
