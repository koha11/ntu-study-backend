import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { FlashcardsService, nextReviewAtFromScore } from './flashcards.service';
import { FlashcardSet } from './entities/flashcard-set.entity';
import { Flashcard } from './entities/flashcard.entity';
import { FlashcardStudyLog } from './entities/flashcard-study-log.entity';
import { SharedGroupFlashcard } from './entities/shared-group-flashcard.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';

describe('FlashcardsService', () => {
  let service: FlashcardsService;
  let setsRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    increment: ReturnType<typeof vi.fn>;
    decrement: ReturnType<typeof vi.fn>;
  };
  let cardsRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let studyLogsRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let sharedRepository: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let groupMembersRepository: {
    findOne: ReturnType<typeof vi.fn>;
  };

  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const otherUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const setId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const cardId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  beforeEach(async () => {
    setsRepository = {
      create: vi.fn((dto: Partial<FlashcardSet>) => ({ ...dto })),
      save: vi.fn((s: FlashcardSet) =>
        Promise.resolve({ ...s, id: s.id ?? setId }),
      ),
      findOne: vi.fn(),
      find: vi.fn(),
      remove: vi.fn(),
      increment: vi.fn().mockResolvedValue(undefined),
      decrement: vi.fn().mockResolvedValue(undefined),
    };

    cardsRepository = {
      create: vi.fn((dto: Partial<Flashcard>) => ({ ...dto })),
      save: vi.fn((c: Flashcard) =>
        Promise.resolve({ ...c, id: c.id ?? cardId }),
      ),
      findOne: vi.fn(),
      remove: vi.fn(),
    };

    studyLogsRepository = {
      create: vi.fn((dto: Partial<FlashcardStudyLog>) => ({ ...dto })),
      save: vi.fn((l: FlashcardStudyLog) =>
        Promise.resolve({ ...l, id: 'log-1111-1111-1111-111111111111' }),
      ),
      find: vi.fn(),
      findOne: vi.fn(),
    };

    const qb = {
      innerJoin: vi.fn(),
      where: vi.fn(),
      getOne: vi.fn().mockResolvedValue(null),
    };
    qb.innerJoin.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);

    sharedRepository = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((d: unknown) => d),
      save: vi.fn((d: unknown) => Promise.resolve(d)),
      remove: vi.fn().mockResolvedValue(undefined),
      createQueryBuilder: vi.fn().mockReturnValue(qb),
    };

    groupMembersRepository = { findOne: vi.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlashcardsService,
        { provide: getRepositoryToken(FlashcardSet), useValue: setsRepository },
        { provide: getRepositoryToken(Flashcard), useValue: cardsRepository },
        {
          provide: getRepositoryToken(FlashcardStudyLog),
          useValue: studyLogsRepository,
        },
        {
          provide: getRepositoryToken(SharedGroupFlashcard),
          useValue: sharedRepository,
        },
        {
          provide: getRepositoryToken(GroupMember),
          useValue: groupMembersRepository,
        },
      ],
    }).compile();

    service = module.get(FlashcardsService);
  });

  describe('createSet', () => {
    it('creates a set with owner_id and name', async () => {
      setsRepository.save.mockImplementation((s: FlashcardSet) =>
        Promise.resolve({ ...s, id: setId }),
      );

      const result = await service.createSet(userId, {
        name: 'Algorithms',
        subject: 'CS2040',
      });

      expect(setsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_id: userId,
          name: 'Algorithms',
          subject: 'CS2040',
          card_count: 0,
        }),
      );
      expect(result.id).toBe(setId);
      expect(result.name).toBe('Algorithms');
    });
  });

  describe('findSet', () => {
    it('returns set with flashcards when user owns it', async () => {
      const flashcards = [{ id: cardId, front: 'Q', back: 'A' }];
      setsRepository.findOne.mockResolvedValue({
        id: setId,
        owner_id: userId,
        name: 'S',
        card_count: 1,
        flashcards,
      });

      const result = await service.findSet(setId, userId);

      expect(setsRepository.findOne).toHaveBeenCalledWith({
        where: { id: setId },
        relations: ['flashcards'],
      });
      expect(result.flashcards).toEqual(flashcards);
    });

    it('throws NotFoundException when set missing', async () => {
      setsRepository.findOne.mockResolvedValue(null);

      await expect(service.findSet(setId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user is not owner', async () => {
      setsRepository.findOne.mockResolvedValue({
        id: setId,
        owner_id: otherUserId,
        name: 'S',
        flashcards: [],
      });

      await expect(service.findSet(setId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findUserSets', () => {
    it('returns sets for owner with latest next_review_at from logs', async () => {
      setsRepository.find.mockResolvedValue([
        {
          id: setId,
          owner_id: userId,
          name: 'S1',
          card_count: 2,
        },
      ]);
      studyLogsRepository.find.mockResolvedValue([
        {
          set_id: setId,
          next_review_at: new Date('2026-06-01T00:00:00.000Z'),
          created_at: new Date('2026-05-01T00:00:00.000Z'),
        },
      ]);

      const rows = await service.findUserSets(userId);

      expect(rows).toHaveLength(1);
      expect(rows[0].next_review_at).toEqual(
        new Date('2026-06-01T00:00:00.000Z'),
      );
    });
  });

  describe('addFlashcard', () => {
    it('adds card and increments card_count when user owns set', async () => {
      setsRepository.findOne.mockResolvedValue({
        id: setId,
        owner_id: userId,
        name: 'S',
        card_count: 0,
      });

      await service.addFlashcard(userId, setId, {
        front: 'Q',
        back: 'A',
      });

      expect(cardsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          set: { id: setId },
          front: 'Q',
          back: 'A',
        }),
      );
      expect(setsRepository.increment).toHaveBeenCalledWith(
        { id: setId },
        'card_count',
        1,
      );
    });

    it('throws when set not found', async () => {
      setsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addFlashcard(userId, setId, { front: 'Q', back: 'A' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when not owner', async () => {
      setsRepository.findOne.mockResolvedValue({
        id: setId,
        owner_id: otherUserId,
        card_count: 0,
      });

      await expect(
        service.addFlashcard(userId, setId, { front: 'Q', back: 'A' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteSet', () => {
    it('removes set when user owns it', async () => {
      const entity = { id: setId, owner_id: userId };
      setsRepository.findOne.mockResolvedValue(entity);
      setsRepository.remove.mockResolvedValue(entity as never);

      await service.deleteSet(userId, setId);

      expect(setsRepository.remove).toHaveBeenCalledWith(entity);
    });

    it('throws ForbiddenException when not owner', async () => {
      setsRepository.findOne.mockResolvedValue({
        id: setId,
        owner_id: otherUserId,
      });

      await expect(service.deleteSet(userId, setId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('removeFlashcard', () => {
    it('deletes card and decrements count when user owns set', async () => {
      cardsRepository.findOne.mockResolvedValue({
        id: cardId,
        set_id: setId,
        set: { id: setId, owner_id: userId, card_count: 3 },
      });
      cardsRepository.remove.mockResolvedValue(undefined as never);

      await service.removeFlashcard(userId, setId, cardId);

      expect(setsRepository.decrement).toHaveBeenCalledWith(
        { id: setId },
        'card_count',
        1,
      );
    });

    it('throws NotFoundException when card missing', async () => {
      cardsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeFlashcard(userId, setId, cardId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('startStudy', () => {
    it('returns total_cards and latest next_review_at', async () => {
      setsRepository.findOne.mockResolvedValue({
        id: setId,
        owner_id: userId,
        card_count: 5,
        flashcards: [{}, {}, {}, {}, {}],
      });
      studyLogsRepository.findOne.mockResolvedValue({
        next_review_at: new Date('2026-05-10T12:00:00.000Z'),
      });

      const result = await service.startStudy(userId, setId);

      expect(result.total_cards).toBe(5);
      expect(result.next_review_at).toEqual(
        new Date('2026-05-10T12:00:00.000Z'),
      );
    });

    it('throws when not owner', async () => {
      setsRepository.findOne.mockResolvedValue({
        id: setId,
        owner_id: otherUserId,
        flashcards: [],
      });

      await expect(service.startStudy(userId, setId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('completeStudy', () => {
    it('saves study log with score and next_review_at', async () => {
      setsRepository.findOne.mockResolvedValue({
        id: setId,
        owner_id: userId,
      });
      studyLogsRepository.save.mockImplementation((l: FlashcardStudyLog) =>
        Promise.resolve({ ...l, id: 'new-log' }),
      );

      const result = await service.completeStudy(userId, setId, {
        score: 80,
      });

      expect(studyLogsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          set_id: setId,
          score: 80,
        }),
      );
      expect(result.score).toBe(80);
      expect(result.next_review_at).toBeInstanceOf(Date);
    });

    it('throws when score out of range', async () => {
      setsRepository.findOne.mockResolvedValue({
        id: setId,
        owner_id: userId,
      });

      await expect(
        service.completeStudy(userId, setId, { score: 101 }),
      ).rejects.toThrow();
    });

    it('throws BadRequestException for score below 0', async () => {
      setsRepository.findOne.mockResolvedValue({ id: setId, owner_id: userId });

      await expect(
        service.completeStudy(userId, setId, { score: -1 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateSet', () => {
    it('updates name and subject when user owns set', async () => {
      const existing = { id: setId, owner_id: userId, name: 'Old', subject: null };
      setsRepository.findOne.mockResolvedValue(existing);
      setsRepository.save.mockImplementation((s: FlashcardSet) =>
        Promise.resolve(s),
      );

      const result = await service.updateSet(userId, setId, {
        name: 'New Name',
        subject: 'CS101',
      });

      expect(result.name).toBe('New Name');
      expect(result.subject).toBe('CS101');
    });

    it('throws NotFoundException when set not found', async () => {
      setsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateSet(userId, setId, { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner', async () => {
      setsRepository.findOne.mockResolvedValue({ id: setId, owner_id: otherUserId });

      await expect(
        service.updateSet(userId, setId, { name: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateFlashcard', () => {
    it('updates front and back when user owns the set', async () => {
      cardsRepository.findOne.mockResolvedValue({
        id: cardId,
        set_id: setId,
        front: 'Old Q',
        back: 'Old A',
        set: { id: setId, owner_id: userId },
      });
      cardsRepository.save.mockImplementation((c: Flashcard) =>
        Promise.resolve(c),
      );

      const result = await service.updateFlashcard(userId, setId, cardId, {
        front: 'New Q',
        back: 'New A',
      });

      expect(result.front).toBe('New Q');
      expect(result.back).toBe('New A');
    });

    it('throws NotFoundException when card not found', async () => {
      cardsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateFlashcard(userId, setId, cardId, { front: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when card belongs to different set', async () => {
      cardsRepository.findOne.mockResolvedValue({
        id: cardId,
        set_id: 'other-set',
        set: { id: 'other-set', owner_id: userId },
      });

      await expect(
        service.updateFlashcard(userId, setId, cardId, { front: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner of the set', async () => {
      cardsRepository.findOne.mockResolvedValue({
        id: cardId,
        set_id: setId,
        set: { id: setId, owner_id: otherUserId },
      });

      await expect(
        service.updateFlashcard(userId, setId, cardId, { front: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('shareSetWithGroup', () => {
    const groupId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

    it('creates a shared record when owner is a group member', async () => {
      setsRepository.findOne.mockResolvedValue({ id: setId, owner_id: userId });
      groupMembersRepository.findOne.mockResolvedValue({ group_id: groupId, user_id: userId });
      sharedRepository.findOne.mockResolvedValue(null);
      sharedRepository.save.mockImplementation((d: unknown) => Promise.resolve({ ...d as object, id: 'share-id' }));

      const result = await service.shareSetWithGroup(userId, setId, groupId);

      expect(sharedRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ set_id: setId, group_id: groupId }),
      );
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when set not found', async () => {
      setsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.shareSetWithGroup(userId, setId, groupId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner of the set', async () => {
      setsRepository.findOne.mockResolvedValue({ id: setId, owner_id: otherUserId });

      await expect(
        service.shareSetWithGroup(userId, setId, groupId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when user is not a group member', async () => {
      setsRepository.findOne.mockResolvedValue({ id: setId, owner_id: userId });
      groupMembersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.shareSetWithGroup(userId, setId, groupId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when already shared with group', async () => {
      setsRepository.findOne.mockResolvedValue({ id: setId, owner_id: userId });
      groupMembersRepository.findOne.mockResolvedValue({ group_id: groupId, user_id: userId });
      sharedRepository.findOne.mockResolvedValue({ id: 'existing', set_id: setId, group_id: groupId });

      await expect(
        service.shareSetWithGroup(userId, setId, groupId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('unshareSetFromGroup', () => {
    const groupId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    it('removes shared record when owner requests unshare', async () => {
      setsRepository.findOne.mockResolvedValue({ id: setId, owner_id: userId });
      const record = { id: 'share-id', set_id: setId, group_id: groupId };
      sharedRepository.findOne.mockResolvedValue(record);

      await service.unshareSetFromGroup(userId, setId, groupId);

      expect(sharedRepository.remove).toHaveBeenCalledWith(record);
    });

    it('throws NotFoundException when set not found', async () => {
      setsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.unshareSetFromGroup(userId, setId, groupId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner', async () => {
      setsRepository.findOne.mockResolvedValue({ id: setId, owner_id: otherUserId });

      await expect(
        service.unshareSetFromGroup(userId, setId, groupId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when shared record does not exist', async () => {
      setsRepository.findOne.mockResolvedValue({ id: setId, owner_id: userId });
      sharedRepository.findOne.mockResolvedValue(null);

      await expect(
        service.unshareSetFromGroup(userId, setId, groupId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getGroupSharedSets', () => {
    const groupId = 'gggggggg-gggg-gggg-gggg-gggggggggggg';

    it('returns mapped shared set rows when user is a member', async () => {
      groupMembersRepository.findOne.mockResolvedValue({ group_id: groupId, user_id: userId });
      sharedRepository.find.mockResolvedValue([
        {
          id: 'share-1',
          created_at: new Date('2026-01-01'),
          set_id: setId,
          group_id: groupId,
          flashcard_set: {
            owner_id: userId,
            name: 'My Set',
            subject: 'Math',
            description: 'Algebra',
            card_count: 5,
          },
        },
      ]);

      const result = await service.getGroupSharedSets(userId, groupId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        share_id: 'share-1',
        set_id: setId,
        group_id: groupId,
        name: 'My Set',
        subject: 'Math',
        card_count: 5,
      });
    });

    it('throws ForbiddenException when user is not a group member', async () => {
      groupMembersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getGroupSharedSets(userId, groupId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('nextReviewAtFromScore', () => {
    it('returns a date in the future for any score', () => {
      const now = new Date();
      const result = nextReviewAtFromScore(50, now);
      expect(result.getTime()).toBeGreaterThan(now.getTime());
    });

    it('returns shorter interval for score 0 than for score 100', () => {
      const now = new Date();
      const low = nextReviewAtFromScore(0, now);
      const high = nextReviewAtFromScore(100, now);
      expect(high.getTime()).toBeGreaterThan(low.getTime());
    });

    it('clamps score above 100 to 100', () => {
      const now = new Date();
      const clamped = nextReviewAtFromScore(150, now);
      const max = nextReviewAtFromScore(100, now);
      expect(clamped.getTime()).toBeCloseTo(max.getTime(), -3);
    });

    it('clamps score below 0 to 0', () => {
      const now = new Date();
      const clamped = nextReviewAtFromScore(-10, now);
      const min = nextReviewAtFromScore(0, now);
      expect(clamped.getTime()).toBeCloseTo(min.getTime(), -3);
    });
  });
});
