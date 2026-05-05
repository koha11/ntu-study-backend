import { Entity, Column, ManyToOne, Unique, Index, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { FlashcardSet } from './flashcard-set.entity';
import { Group } from '@modules/groups/entities/group.entity';

@Entity('shared_group_flashcards')
@Unique(['set_id', 'group_id'])
@Index(['set_id'])
@Index(['group_id'])
export class SharedGroupFlashcard extends BaseEntity {
  @ManyToOne(() => FlashcardSet, (set) => set.shared_groups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'set_id' })
  flashcard_set!: FlashcardSet;

  @Column({ name: 'set_id', type: 'uuid' })
  set_id!: string;

  @ManyToOne(() => Group, (group) => group.shared_flashcards, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  group!: Group;

  @Column({ name: 'group_id', type: 'uuid' })
  group_id!: string;
}
