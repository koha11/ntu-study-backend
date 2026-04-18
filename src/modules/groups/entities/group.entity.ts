import { Entity, Column, ManyToOne, OneToMany, Index } from 'typeorm';
import { GroupStatus } from '@common/enums';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { GroupMember } from './group-member.entity';
import { GroupInvitation } from './group-invitation.entity';
import { Task } from '@modules/tasks/entities/task.entity';
import { ContributionRating } from '@modules/contributions/entities/contribution-rating.entity';
import { DriveItem } from '@modules/google-drive/entities/drive-item.entity';
import { SharedGroupFlashcard } from '@modules/flashcards/entities/shared-group-flashcard.entity';
import { AuditLog } from '@modules/audit-logs/entities/audit-log.entity';

@Entity('groups')
@Index(['leader_id'])
@Index(['status'])
@Index(['created_at'])
export class Group extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToOne(() => User, (user) => user.groups_led, { onDelete: 'CASCADE' })
  leader!: User;

  @Column({ type: 'uuid' })
  leader_id!: string;

  @Column({ type: 'date', nullable: true })
  report_date?: Date;

  @Column({ type: 'text', array: true, default: () => `'{}'` })
  tags!: string[];

  @Column({ type: 'enum', enum: GroupStatus, default: GroupStatus.ACTIVE })
  status!: GroupStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  drive_folder_id?: string;

  @Column({ type: 'text', nullable: true })
  canva_file_url?: string;

  @Column({ type: 'text', nullable: true })
  doc_file_url?: string;

  // Relationships
  @OneToMany(() => GroupMember, (member) => member.group, { cascade: true })
  members!: GroupMember[];

  @OneToMany(() => GroupInvitation, (invitation) => invitation.group, {
    cascade: true,
  })
  invitations!: GroupInvitation[];

  @OneToMany(() => Task, (task) => task.group)
  tasks!: Task[];

  @OneToMany(() => ContributionRating, (rating) => rating.group)
  contribution_ratings!: ContributionRating[];

  @OneToMany(() => DriveItem, (item) => item.group)
  drive_items!: DriveItem[];

  @OneToMany(() => SharedGroupFlashcard, (shared) => shared.group)
  shared_flashcards!: SharedGroupFlashcard[];

  @OneToMany(() => AuditLog, (log) => log.group)
  audit_logs!: AuditLog[];
}
