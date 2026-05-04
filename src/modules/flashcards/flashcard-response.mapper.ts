import type { Flashcard } from './entities/flashcard.entity';
import type { FlashcardSet } from './entities/flashcard-set.entity';
import type { FlashcardStudyLog } from './entities/flashcard-study-log.entity';
import type { FlashcardSetListRow } from './flashcards.service';

export function serializeFlashcardForApi(card: Flashcard): Record<string, unknown> {
  return {
    id: card.id,
    created_at: card.created_at,
    updated_at: card.updated_at,
    set_id: card.set_id,
    front: card.front,
    back: card.back,
  };
}

export function serializeFlashcardSetForApi(
  set: FlashcardSet | FlashcardSetListRow,
  options?: { omitCards?: boolean },
): Record<string, unknown> {
  const listRow = set as FlashcardSetListRow;
  const base: Record<string, unknown> = {
    id: set.id,
    created_at: set.created_at,
    updated_at: set.updated_at,
    owner_id: set.owner_id,
    name: set.name,
    subject: set.subject ?? null,
    description: set.description ?? null,
    card_count: set.card_count,
    next_review_at: listRow.next_review_at ?? null,
  };
  if (!options?.omitCards) {
    base.flashcards = (set.flashcards ?? []).map(serializeFlashcardForApi);
  }
  return base;
}

export function serializeStudyLogForApi(log: FlashcardStudyLog): Record<string, unknown> {
  return {
    id: log.id,
    created_at: log.created_at,
    updated_at: log.updated_at,
    user_id: log.user_id,
    set_id: log.set_id,
    score: log.score,
    next_review_at: log.next_review_at ?? null,
  };
}
