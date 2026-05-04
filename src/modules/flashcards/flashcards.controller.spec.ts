import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

describe('FlashcardsController', () => {
  let controller: FlashcardsController;
  let flashcardsService: {
    createSet: ReturnType<typeof vi.fn>;
    findUserSets: ReturnType<typeof vi.fn>;
    findSet: ReturnType<typeof vi.fn>;
    deleteSet: ReturnType<typeof vi.fn>;
    addFlashcard: ReturnType<typeof vi.fn>;
    removeFlashcard: ReturnType<typeof vi.fn>;
    startStudy: ReturnType<typeof vi.fn>;
    completeStudy: ReturnType<typeof vi.fn>;
  };

  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const setId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const cardId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  beforeEach(async () => {
    flashcardsService = {
      createSet: vi.fn(),
      findUserSets: vi.fn(),
      findSet: vi.fn(),
      deleteSet: vi.fn(),
      addFlashcard: vi.fn(),
      removeFlashcard: vi.fn(),
      startStudy: vi.fn(),
      completeStudy: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlashcardsController],
      providers: [{ provide: FlashcardsService, useValue: flashcardsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(FlashcardsController);
  });

  it('createSet forwards user id and dto', async () => {
    flashcardsService.createSet.mockResolvedValue({
      id: setId,
      owner_id: userId,
      name: 'S',
      card_count: 0,
    });

    await controller.createSet(
      { user: { id: userId } } as never,
      { name: 'S', subject: 'CS' } as never,
    );

    expect(flashcardsService.createSet).toHaveBeenCalledWith(userId, {
      name: 'S',
      subject: 'CS',
    });
  });

  it('findUserSets forwards user id', async () => {
    flashcardsService.findUserSets.mockResolvedValue([]);

    await controller.findUserSets({ user: { id: userId } } as never);

    expect(flashcardsService.findUserSets).toHaveBeenCalledWith(userId);
  });

  it('findSet forwards id and user id', async () => {
    flashcardsService.findSet.mockResolvedValue({
      id: setId,
      flashcards: [],
      card_count: 0,
    });

    await controller.findSet({ user: { id: userId } } as never, setId);

    expect(flashcardsService.findSet).toHaveBeenCalledWith(setId, userId);
  });

  it('deleteSet forwards ids', async () => {
    flashcardsService.deleteSet.mockResolvedValue(undefined);

    await controller.deleteSet({ user: { id: userId } } as never, setId);

    expect(flashcardsService.deleteSet).toHaveBeenCalledWith(userId, setId);
  });

  it('addFlashcard forwards ids and dto', async () => {
    flashcardsService.addFlashcard.mockResolvedValue({ id: cardId });

    await controller.addFlashcard(
      { user: { id: userId } } as never,
      setId,
      { front: 'Q', back: 'A' } as never,
    );

    expect(flashcardsService.addFlashcard).toHaveBeenCalledWith(userId, setId, {
      front: 'Q',
      back: 'A',
    });
  });

  it('removeFlashcard forwards ids', async () => {
    flashcardsService.removeFlashcard.mockResolvedValue(undefined);

    await controller.removeFlashcard(
      { user: { id: userId } } as never,
      setId,
      cardId,
    );

    expect(flashcardsService.removeFlashcard).toHaveBeenCalledWith(
      userId,
      setId,
      cardId,
    );
  });

  it('startStudy forwards ids', async () => {
    flashcardsService.startStudy.mockResolvedValue({
      set_id: setId,
      total_cards: 3,
      next_review_at: null,
    });

    await controller.startStudy({ user: { id: userId } } as never, setId);

    expect(flashcardsService.startStudy).toHaveBeenCalledWith(userId, setId);
  });

  it('completeStudy forwards ids and score', async () => {
    flashcardsService.completeStudy.mockResolvedValue({
      id: 'log1',
      score: 75,
    });

    await controller.completeStudy(
      { user: { id: userId } } as never,
      setId,
      { score: 75 } as never,
    );

    expect(flashcardsService.completeStudy).toHaveBeenCalledWith(
      userId,
      setId,
      { score: 75 },
    );
  });
});
