import { Entity, Column, ManyToOne, Index, JoinColumn, RelationId } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { FlashcardSet } from './flashcard-set.entity';

@Entity('flashcards')
@Index(['set'])
export class Flashcard extends BaseEntity {
  @ManyToOne(() => FlashcardSet, (set) => set.flashcards, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'set_id' })
  set!: FlashcardSet;

  /** FK value (same column as `set`); use for queries without loading the relation. */
  @RelationId((card: Flashcard) => card.set)
  set_id!: string;

  @Column({ type: 'text' })
  front!: string;

  @Column({ type: 'text' })
  back!: string;
}
