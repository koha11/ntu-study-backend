import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { NotificationDeliveryChannel } from '@common/enums';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';

@Entity('notifications')
@Index(['recipient_id'])
@Index(['type'])
@Index(['is_read'])
@Index(['created_at'])
export class Notification extends BaseEntity {
  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  recipient!: User;

  @Column({ type: 'uuid' })
  recipient_id!: string;

  @Column({ type: 'varchar', length: 100 })
  type!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'boolean', default: false })
  is_read!: boolean;

  @Column({
    type: 'enum',
    enum: NotificationDeliveryChannel,
    default: NotificationDeliveryChannel.WEB,
  })
  delivery_channel!: NotificationDeliveryChannel;

  @Column({ type: 'varchar', length: 255, nullable: true })
  related_entity_type?: string;

  @Column({ type: 'uuid', nullable: true })
  related_entity_id?: string;
}
