import { Entity, Column, ManyToOne, Index, Check, JoinColumn } from 'typeorm';
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
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => FlashcardSet, (set) => set.study_logs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'set_id' })
  flashcard_set!: FlashcardSet;

  @Column({ name: 'set_id', type: 'uuid' })
  set_id!: string;

  @Column({ type: 'smallint' })
  score!: number;

  @Column({ type: 'timestamptz', nullable: true })
  next_review_at?: Date;
}
