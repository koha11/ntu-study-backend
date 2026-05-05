import { Entity, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
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
  @JoinColumn({ name: 'group_id' })
  group!: Group;

  @Column({ name: 'group_id', type: 'uuid' })
  group_id!: string;

  @ManyToOne(() => User, (user) => user.audit_logs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'actor_id' })
  actor?: User;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
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
