import { Entity, Column, ManyToOne, Unique, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Group } from './group.entity';

@Entity('group_members')
@Unique(['group_id', 'user_id'])
@Index(['group_id'])
@Index(['user_id'])
@Index(['is_active'])
export class GroupMember extends BaseEntity {
  @ManyToOne(() => Group, (group) => group.members, { onDelete: 'CASCADE' })
  group!: Group;

  @Column({ type: 'uuid' })
  group_id!: string;

  @ManyToOne(() => User, (user) => user.group_memberships, {
    onDelete: 'CASCADE',
  })
  user!: User;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'boolean', default: false })
  is_active!: boolean;
}
