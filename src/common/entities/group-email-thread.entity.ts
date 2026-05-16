import { Entity, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { User } from '@modules/users/entities/user.entity';

@Entity('group_email_threads')
@Unique(['group_id', 'user_id'])
@Index(['group_id'])
@Index(['user_id'])
export class GroupEmailThread extends BaseEntity {
  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: Group;

  @Column({ name: 'group_id', type: 'uuid' })
  group_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id!: string;

  /** Message-ID of the first (thread-root) email, used in In-Reply-To on follow-ups. */
  @Column({ type: 'varchar', length: 512 })
  thread_message_id!: string;
}
