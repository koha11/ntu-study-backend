import { describe, it, expect } from 'vitest';
import {
  serializeFlashcardForApi,
  serializeFlashcardSetForApi,
  serializeStudyLogForApi,
} from './flashcard-response.mapper';

describe('flashcard-response.mapper', () => {
  it('serializeFlashcardSetForApi omits flashcards when omitCards', () => {
    const json = serializeFlashcardSetForApi(
      {
        id: 's1',
        owner_id: 'u1',
        name: 'N',
        card_count: 2,
        created_at: new Date(),
        updated_at: new Date(),
      } as never,
      { omitCards: true },
    );
    expect(json.flashcards).toBeUndefined();
    expect(json.next_review_at).toBeNull();
  });

  it('serializeFlashcardSetForApi includes empty flashcards by default', () => {
    const json = serializeFlashcardSetForApi({
      id: 's1',
      owner_id: 'u1',
      name: 'N',
      card_count: 0,
      flashcards: [],
      created_at: new Date(),
      updated_at: new Date(),
    } as never);
    expect(json.flashcards).toEqual([]);
  });

  it('serializeFlashcardForApi maps fields', () => {
    const json = serializeFlashcardForApi({
      id: 'c1',
      set_id: 's1',
      front: 'Q',
      back: 'A',
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-02'),
    } as never);
    expect(json.front).toBe('Q');
    expect(json.set_id).toBe('s1');
  });

  it('serializeStudyLogForApi maps fields', () => {
    const json = serializeStudyLogForApi({
      id: 'l1',
      user_id: 'u1',
      set_id: 's1',
      score: 80,
      next_review_at: new Date('2026-06-01'),
      created_at: new Date(),
      updated_at: new Date(),
    } as never);
    expect(json.score).toBe(80);
  });
});
