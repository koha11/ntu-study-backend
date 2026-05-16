import {
  Entity,
  Column,
  ManyToOne,
  Unique,
  Index,
  Check,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { Task } from '@modules/tasks/entities/task.entity';

@Entity('contribution_ratings')
@Unique(['task', 'rater'])
@Check(`("score" IS NULL) OR ("score" >= 0 AND "score" <= 10)`)
@Index(['group', 'round_started_at'])
@Index(['group', 'rater', 'round_started_at'])
@Index(['task'])
@Index(['rater'])
@Index(['due_date'])
export class ContributionRating extends BaseEntity {
  @ManyToOne(() => Group, (group) => group.contribution_ratings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  group!: Group;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @Column({ type: 'timestamptz' })
  round_started_at!: Date;

  @Column({ type: 'boolean', default: false })
  is_round_closed!: boolean;

  @ManyToOne(() => User, (user) => user.ratings_given, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rater_id' })
  rater!: User;

  @Column({ type: 'smallint', nullable: true })
  score!: number | null;

  @Column({ type: 'timestamptz' })
  due_date!: Date;
}
