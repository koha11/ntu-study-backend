import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { AuditLogSource } from '@common/enums';
import { BaseEntity } from '@common/entities/base.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { User } from '@modules/users/entities/user.entity';

@Entity('audit_logs')
@Index(['group_id'])
@Index(['actor_id'])
@Index(['action'])
@Index(['source'])
@Index(['created_at'])
export class AuditLog extends BaseEntity {
  @ManyToOne(() => Group, (group) => group.audit_logs, { onDelete: 'CASCADE' })
  group!: Group;

  @Column({ type: 'uuid' })
  group_id!: string;

  @ManyToOne(() => User, (user) => user.audit_logs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  actor?: User;

  @Column({ type: 'uuid', nullable: true })
  actor_id?: string;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: AuditLogSource, default: AuditLogSource.APP })
  source!: AuditLogSource;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;
}
