import { Entity, Column, ManyToOne, Unique, Index, Check } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Group } from '@modules/groups/entities/group.entity';

@Entity('contribution_ratings')
@Unique(['group_id', 'rater_id', 'ratee_id'])
@Check(`"rater_id" != "ratee_id"`)
@Check('"score" >= 0 AND "score" <= 10')
@Index(['group_id'])
@Index(['rater_id'])
@Index(['ratee_id'])
@Index(['due_date'])
export class ContributionRating extends BaseEntity {
  @ManyToOne(() => Group, (group) => group.contribution_ratings, {
    onDelete: 'CASCADE',
  })
  group!: Group;

  @Column({ type: 'uuid' })
  group_id!: string;

  @ManyToOne(() => User, (user) => user.ratings_given, { onDelete: 'CASCADE' })
  rater!: User;

  @Column({ type: 'uuid' })
  rater_id!: string;

  @ManyToOne(() => User, (user) => user.ratings_received, {
    onDelete: 'CASCADE',
  })
  ratee!: User;

  @Column({ type: 'uuid' })
  ratee_id!: string;

  @Column({ type: 'smallint' })
  score!: number;

  @Column({ type: 'timestamptz' })
  due_date!: Date;
}
