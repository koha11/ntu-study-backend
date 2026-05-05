import { Entity, Column, ManyToOne, OneToMany, Index, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';
import { Flashcard } from './flashcard.entity';
import { SharedGroupFlashcard } from './shared-group-flashcard.entity';
import { FlashcardStudyLog } from './flashcard-study-log.entity';

@Entity('flashcard_sets')
@Index(['owner_id'])
@Index(['created_at'])
export class FlashcardSet extends BaseEntity {
  @ManyToOne(() => User, (user) => user.flashcard_sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @Column({ name: 'owner_id', type: 'uuid' })
  owner_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'int', default: 0 })
  card_count!: number;

  // Relationships
  @OneToMany(() => Flashcard, (card) => card.set, { cascade: true })
  flashcards!: Flashcard[];

  @OneToMany(() => SharedGroupFlashcard, (shared) => shared.flashcard_set, {
    cascade: true,
  })
  shared_groups!: SharedGroupFlashcard[];

  @OneToMany(() => FlashcardStudyLog, (log) => log.flashcard_set)
  study_logs!: FlashcardStudyLog[];
}
