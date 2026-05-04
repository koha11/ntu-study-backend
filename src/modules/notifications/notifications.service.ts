import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationDeliveryChannel } from '@common/enums';

@Injectable()
export class NotificationsService {
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

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
    });
    if (!notification || notification.recipient_id !== userId) {
      throw new NotFoundException('Notification not found');
    }
    notification.is_read = true;
    return this.notificationsRepository.save(notification);
  }
}
