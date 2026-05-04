import { Entity, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { InvitationStatus } from '@common/enums';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Group } from './group.entity';

@Entity('group_invitations')
@Unique(['token'])
@Index(['group_id'])
@Index(['invited_by'])
@Index(['status'])
@Index(['expires_at'])
export class GroupInvitation extends BaseEntity {
  @ManyToOne(() => Group, (group) => group.invitations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: Group;

  @Column({ type: 'uuid' })
  group_id!: string;

  @ManyToOne(() => User, (user) => user.invitations_sent, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invited_by_id' })
  invited_by!: User;

  @Column({ type: 'uuid' })
  invited_by_id!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 512 })
  token!: string;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status!: InvitationStatus;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;
}
