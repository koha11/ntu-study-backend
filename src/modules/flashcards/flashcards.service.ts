import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlashcardSet } from './entities/flashcard-set.entity';
import { Flashcard } from './entities/flashcard.entity';
import { FlashcardStudyLog } from './entities/flashcard-study-log.entity';

export type CreateFlashcardSetInput = {
  name: string;
  subject?: string;
  description?: string;
};

export type CreateFlashcardInput = {
  front: string;
  back: string;
};

export type CompleteStudyInput = {
  score: number;
};

export type UpdateFlashcardSetInput = {
  name?: string;
  subject?: string | null;
  description?: string | null;
};

export type UpdateFlashcardInput = {
  front?: string;
  back?: string;
};

/** Higher score → longer interval before next review (set-level). */
export function nextReviewAtFromScore(score: number, now: Date): Date {
  const clamped = Math.min(100, Math.max(0, score));
  const minHours = 1;
  const maxHours = 14 * 24;
  const t = clamped / 100;
  const hours = minHours + t * (maxHours - minHours);
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export type FlashcardSetListRow = FlashcardSet & {
  next_review_at?: Date | null;
};

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectRepository(FlashcardSet)
    private setsRepository: Repository<FlashcardSet>,
    @InjectRepository(Flashcard)
    private cardsRepository: Repository<Flashcard>,
    @InjectRepository(FlashcardStudyLog)
    private studyLogsRepository: Repository<FlashcardStudyLog>,
  ) {}

  async createSet(
    userId: string,
    data: CreateFlashcardSetInput,
  ): Promise<FlashcardSet> {
    const entity = this.setsRepository.create({
      owner_id: userId,
      name: data.name,
      subject: data.subject ?? null,
      description: data.description ?? null,
      card_count: 0,
    });
    return this.setsRepository.save(entity);
  }

  async findSet(setId: string, userId: string): Promise<FlashcardSet> {
    const set = await this.setsRepository.findOne({
      where: { id: setId },
      relations: ['flashcards'],
    });
    if (!set) {
      throw new NotFoundException('Flashcard set not found');
    }
    if (set.owner_id !== userId) {
      throw new ForbiddenException('You do not own this flashcard set');
    }
    return set;
  }

  async findUserSets(userId: string): Promise<FlashcardSetListRow[]> {
    const sets = await this.setsRepository.find({
      where: { owner_id: userId },
      order: { created_at: 'DESC' },
    });

    const logs = await this.studyLogsRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    const latestBySet = new Map<string, Date | null | undefined>();
    for (const log of logs) {
      if (!latestBySet.has(log.set_id)) {
        latestBySet.set(log.set_id, log.next_review_at ?? null);
      }
    }

    return sets.map((s) => ({
      ...s,
      next_review_at: latestBySet.get(s.id),
    }));
  }

  async addFlashcard(
    userId: string,
    setId: string,
    data: CreateFlashcardInput,
  ): Promise<Flashcard> {
    const set = await this.setsRepository.findOne({ where: { id: setId } });
    if (!set) {
      throw new NotFoundException('Flashcard set not found');
    }
    if (set.owner_id !== userId) {
      throw new ForbiddenException('You do not own this flashcard set');
    }

    const card = this.cardsRepository.create({
      set: { id: setId } as FlashcardSet,
      front: data.front,
      back: data.back,
    });
    const saved = await this.cardsRepository.save(card);
    await this.setsRepository.increment({ id: setId }, 'card_count', 1);
    return saved;
  }

  async updateSet(
    userId: string,
    setId: string,
    data: UpdateFlashcardSetInput,
  ): Promise<FlashcardSet> {
    const set = await this.setsRepository.findOne({ where: { id: setId } });
    if (!set) {
      throw new NotFoundException('Flashcard set not found');
    }
    if (set.owner_id !== userId) {
      throw new ForbiddenException('You do not own this flashcard set');
    }
    if (data.name !== undefined) set.name = data.name;
    if (data.subject !== undefined) set.subject = data.subject;
    if (data.description !== undefined) set.description = data.description;
    return this.setsRepository.save(set);
  }

  async updateFlashcard(
    userId: string,
    setId: string,
    cardId: string,
    data: UpdateFlashcardInput,
  ): Promise<Flashcard> {
    const card = await this.cardsRepository.findOne({
      where: { id: cardId },
      relations: ['set'],
    });
    if (!card || !card.set) {
      throw new NotFoundException('Flashcard not found');
    }
    if (card.set_id !== setId) {
      throw new NotFoundException('Flashcard not found in this set');
    }
    if (card.set.owner_id !== userId) {
      throw new ForbiddenException('You do not own this flashcard set');
    }
    if (data.front !== undefined) card.front = data.front;
    if (data.back !== undefined) card.back = data.back;
    return this.cardsRepository.save(card);
  }

  async deleteSet(userId: string, setId: string): Promise<void> {
    const set = await this.setsRepository.findOne({ where: { id: setId } });
    if (!set) {
      throw new NotFoundException('Flashcard set not found');
    }
    if (set.owner_id !== userId) {
      throw new ForbiddenException('You do not own this flashcard set');
    }
    await this.setsRepository.remove(set);
  }

  async removeFlashcard(
    userId: string,
    setId: string,
    cardId: string,
  ): Promise<void> {
    const card = await this.cardsRepository.findOne({
      where: { id: cardId },
      relations: ['set'],
    });
    if (!card || !card.set) {
      throw new NotFoundException('Flashcard not found');
    }
    if (card.set_id !== setId) {
      throw new NotFoundException('Flashcard not found in this set');
    }
    if (card.set.owner_id !== userId) {
      throw new ForbiddenException('You do not own this flashcard set');
    }
    await this.cardsRepository.remove(card);
    await this.setsRepository.decrement({ id: card.set_id }, 'card_count', 1);
  }

  async startStudy(
    userId: string,
    setId: string,
  ): Promise<{
    set_id: string;
    total_cards: number;
    next_review_at: Date | null;
  }> {
    const set = await this.setsRepository.findOne({
      where: { id: setId },
      relations: ['flashcards'],
    });
    if (!set) {
      throw new NotFoundException('Flashcard set not found');
    }
    if (set.owner_id !== userId) {
      throw new ForbiddenException('You do not own this flashcard set');
    }

    const latest = await this.studyLogsRepository.findOne({
      where: { user_id: userId, set_id: setId },
      order: { created_at: 'DESC' },
    });

    return {
      set_id: setId,
      total_cards: set.flashcards?.length ?? set.card_count,
      next_review_at: latest?.next_review_at ?? null,
    };
  }

  async completeStudy(
    userId: string,
    setId: string,
    data: CompleteStudyInput,
  ): Promise<FlashcardStudyLog> {
    if (data.score < 0 || data.score > 100) {
      throw new BadRequestException('score must be between 0 and 100');
    }

    const set = await this.setsRepository.findOne({ where: { id: setId } });
    if (!set) {
      throw new NotFoundException('Flashcard set not found');
    }
    if (set.owner_id !== userId) {
      throw new ForbiddenException('You do not own this flashcard set');
    }

    const now = new Date();
    const nextAt = nextReviewAtFromScore(data.score, now);

    const log = this.studyLogsRepository.create({
      user_id: userId,
      set_id: setId,
      score: data.score,
      next_review_at: nextAt,
    });
    return this.studyLogsRepository.save(log);
  }
}
