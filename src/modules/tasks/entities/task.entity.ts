import { Entity, Column, ManyToOne, OneToMany, Index } from 'typeorm';
import { TaskStatus } from '@common/enums';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Group } from '@modules/groups/entities/group.entity';

@Entity('tasks')
@Index(['group_id'])
@Index(['created_by'])
@Index(['assignee_id'])
@Index(['status'])
@Index(['due_date'])
@Index(['parent_task_id'])
export class Task extends BaseEntity {
  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToOne(() => Group, (group) => group.tasks, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  group?: Group;

  @Column({ type: 'uuid', nullable: true })
  group_id?: string;

  @ManyToOne(() => Task, (task) => task.subtasks, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  parent_task?: Task;

  @Column({ type: 'uuid', nullable: true })
  parent_task_id?: string;

  @OneToMany(() => Task, (task) => task.parent_task)
  subtasks!: Task[];

  @ManyToOne(() => User, (user) => user.tasks_created, { onDelete: 'CASCADE' })
  created_by!: User;

  @Column({ type: 'uuid' })
  created_by_id!: string;

  @ManyToOne(() => User, (user) => user.tasks_assigned, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  assignee?: User;

  @Column({ type: 'uuid', nullable: true })
  assignee_id?: string;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status!: TaskStatus;

  @Column({ type: 'timestamptz', nullable: true })
  due_date?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at?: Date;

  @ManyToOne(() => User, (user) => user.tasks_reviewed, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  reviewed_by?: User;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by_id?: string;
}
