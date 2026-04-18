import { Entity, Column, ManyToOne, Index, Check } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { FlashcardSet } from './flashcard-set.entity';

@Entity('flashcard_study_logs')
@Check('"score" >= 0 AND "score" <= 100')
@Index(['user_id'])
@Index(['set_id'])
@Index(['next_review_at'])
export class FlashcardStudyLog extends BaseEntity {
  @ManyToOne(() => User, (user) => user.study_logs, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => FlashcardSet, (set) => set.study_logs, {
    onDelete: 'CASCADE',
  })
  flashcard_set!: FlashcardSet;

  @Column({ type: 'uuid' })
  set_id!: string;

  @Column({ type: 'smallint' })
  score!: number;

  @Column({ type: 'timestamptz', nullable: true })
  next_review_at?: Date;
}
