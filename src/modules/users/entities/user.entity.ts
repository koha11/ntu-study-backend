import {
  Entity,
  Column,
  Unique,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { UserRole } from '@common/enums';
import { BaseEntity } from '@common/entities/base.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { GroupInvitation } from '@modules/groups/entities/group-invitation.entity';
import { Task } from '@modules/tasks/entities/task.entity';
import { ContributionRating } from '@modules/contributions/entities/contribution-rating.entity';
import { FlashcardSet } from '@modules/flashcards/entities/flashcard-set.entity';
import { FlashcardStudyLog } from '@modules/flashcards/entities/flashcard-study-log.entity';
import { AuditLog } from '@modules/audit-logs/entities/audit-log.entity';
import { Notification } from '@modules/notifications/entities/notification.entity';

@Entity('users')
@Unique(['email'])
@Index(['role'])
@Index(['is_active'])
@Index(['created_at'])
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  full_name!: string;

  @Column({ type: 'text', nullable: true })
  avatar_url?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ type: 'text', nullable: true })
  google_access_token?: string;

  @Column({ type: 'text', nullable: true })
  google_refresh_token?: string;

  @Column({ type: 'timestamptz', nullable: true })
  token_expires_at?: Date;

  @Column({ type: 'bigint', nullable: true })
  drive_total_quota?: number;

  @Column({ type: 'bigint', nullable: true })
  drive_used_quota?: number;

  @Column({ type: 'timestamptz', nullable: true })
  quota_last_updated?: Date;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'boolean', default: true })
  notification_enabled!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at?: Date;

  // Relationships
  @OneToMany(() => Group, (group) => group.leader)
  groups_led!: Group[];

  @OneToMany(() => GroupMember, (member) => member.user)
  group_memberships!: GroupMember[];

  @OneToMany(() => GroupInvitation, (invitation) => invitation.invited_by)
  invitations_sent!: GroupInvitation[];

  @OneToMany(() => Task, (task) => task.created_by)
  tasks_created!: Task[];

  @OneToMany(() => Task, (task) => task.assignee)
  tasks_assigned!: Task[];

  @OneToMany(() => Task, (task) => task.reviewed_by)
  tasks_reviewed!: Task[];

  @OneToMany(() => ContributionRating, (rating) => rating.rater)
  ratings_given!: ContributionRating[];

  @OneToMany(() => ContributionRating, (rating) => rating.ratee)
  ratings_received!: ContributionRating[];

  @OneToMany(() => FlashcardSet, (set) => set.owner)
  flashcard_sets!: FlashcardSet[];

  @OneToMany(() => FlashcardStudyLog, (log) => log.user)
  study_logs!: FlashcardStudyLog[];

  @OneToMany(() => AuditLog, (log) => log.actor)
  audit_logs!: AuditLog[];

  @OneToMany(() => Notification, (notification) => notification.recipient)
  notifications!: Notification[];
}
