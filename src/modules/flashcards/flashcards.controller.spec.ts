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
    updateFlashcard: ReturnType<typeof vi.fn>;
    updateSet: ReturnType<typeof vi.fn>;
    getGroupSharedSets: ReturnType<typeof vi.fn>;
    shareSetWithGroup: ReturnType<typeof vi.fn>;
    unshareSetFromGroup: ReturnType<typeof vi.fn>;
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
      updateFlashcard: vi.fn(),
      updateSet: vi.fn(),
      getGroupSharedSets: vi.fn(),
      shareSetWithGroup: vi.fn(),
      unshareSetFromGroup: vi.fn(),
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

    await controller.addFlashcard({ user: { id: userId } } as never, setId, {
      front: 'Q',
      back: 'A',
    } as never);

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

    await controller.completeStudy({ user: { id: userId } } as never, setId, {
      score: 75,
    } as never);

    expect(flashcardsService.completeStudy).toHaveBeenCalledWith(
      userId,
      setId,
      { score: 75 },
    );
  });

  it('updateFlashcard forwards ids and dto', async () => {
    flashcardsService.updateFlashcard.mockResolvedValue({
      id: cardId,
      front: 'New Q',
      back: 'New A',
    });

    await controller.updateFlashcard(
      { user: { id: userId } } as never,
      setId,
      cardId,
      { front: 'New Q' } as never,
    );

    expect(flashcardsService.updateFlashcard).toHaveBeenCalledWith(
      userId,
      setId,
      cardId,
      { front: 'New Q' },
    );
  });

  it('updateSet forwards ids and dto', async () => {
    flashcardsService.updateSet.mockResolvedValue({
      id: setId,
      name: 'Updated',
      card_count: 2,
    });

    await controller.updateSet({ user: { id: userId } } as never, setId, {
      name: 'Updated',
    } as never);

    expect(flashcardsService.updateSet).toHaveBeenCalledWith(userId, setId, {
      name: 'Updated',
    });
  });

  it('getGroupSharedSets forwards user and group ids', async () => {
    flashcardsService.getGroupSharedSets.mockResolvedValue([]);
    const groupId = 'eeee-eeee-eeee-eeee';

    await controller.getGroupSharedSets(
      { user: { id: userId } } as never,
      groupId,
    );

    expect(flashcardsService.getGroupSharedSets).toHaveBeenCalledWith(
      userId,
      groupId,
    );
  });

  it('shareSet delegates to service and maps response', async () => {
    const shareId = 'ffff-ffff-ffff-ffff';
    const groupId = 'gggg-gggg-gggg-gggg';
    flashcardsService.shareSetWithGroup.mockResolvedValue({
      id: shareId,
      set_id: setId,
      group_id: groupId,
      created_at: new Date(),
    });

    const result = await controller.shareSet(
      { user: { id: userId } } as never,
      setId,
      { group_id: groupId } as never,
    );

    expect(flashcardsService.shareSetWithGroup).toHaveBeenCalledWith(
      userId,
      setId,
      groupId,
    );
    expect(result).toMatchObject({
      share_id: shareId,
      set_id: setId,
      group_id: groupId,
    });
  });

  it('unshareSet delegates to service', async () => {
    flashcardsService.unshareSetFromGroup.mockResolvedValue(undefined);
    const groupId = 'hhhh-hhhh-hhhh-hhhh';

    await controller.unshareSet(
      { user: { id: userId } } as never,
      setId,
      groupId,
    );

    expect(flashcardsService.unshareSetFromGroup).toHaveBeenCalledWith(
      userId,
      setId,
      groupId,
    );
  });
});
