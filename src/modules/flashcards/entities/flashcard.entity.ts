import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { FlashcardSet } from './flashcard-set.entity';

@Entity('flashcards')
@Index(['set_id'])
export class Flashcard extends BaseEntity {
  @ManyToOne(() => FlashcardSet, (set) => set.flashcards, {
    onDelete: 'CASCADE',
  })
  set!: FlashcardSet;

  @Column({ type: 'uuid' })
  set_id!: string;

  @Column({ type: 'text' })
  front!: string;

  @Column({ type: 'text' })
  back!: string;
}
