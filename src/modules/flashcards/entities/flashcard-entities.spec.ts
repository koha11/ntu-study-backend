import { describe, it, expect } from 'vitest';
import { FlashcardSet } from './flashcard-set.entity';
import { Flashcard } from './flashcard.entity';
import { FlashcardStudyLog } from './flashcard-study-log.entity';
import { SharedGroupFlashcard } from './shared-group-flashcard.entity';

describe('Flashcard Entities', () => {
  it('FlashcardSet can be instantiated and properties assigned', () => {
    const entity = new FlashcardSet();
    entity.name = 'Algorithms';
    entity.owner_id = 'user-1';
    entity.card_count = 0;
    expect(entity.name).toBe('Algorithms');
    expect(entity.card_count).toBe(0);
  });

  it('Flashcard can be instantiated and properties assigned', () => {
    const entity = new Flashcard();
    entity.front = 'What is O(n)?';
    entity.back = 'Linear time';
    expect(entity.front).toBe('What is O(n)?');
  });

  it('FlashcardStudyLog can be instantiated and properties assigned', () => {
    const entity = new FlashcardStudyLog();
    entity.score = 80;
    entity.user_id = 'user-1';
    entity.set_id = 'set-1';
    expect(entity.score).toBe(80);
  });

  it('SharedGroupFlashcard can be instantiated and properties assigned', () => {
    const entity = new SharedGroupFlashcard();
    entity.set_id = 'set-1';
    entity.group_id = 'group-1';
    expect(entity.set_id).toBe('set-1');
  });
});
