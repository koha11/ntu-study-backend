import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupEmailThreadService } from './group-email-thread.service';
import { GroupEmailThread } from '@common/entities/group-email-thread.entity';

describe('GroupEmailThreadService', () => {
  let service: GroupEmailThreadService;
  let threadsRepository: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  const groupId = 'group-uuid-1';
  const userId = 'user-uuid-1';
  const messageId = '<abc123@ntu-study.local>';

  beforeEach(async () => {
    threadsRepository = {
      findOne: vi.fn(),
      create: vi.fn((data) => ({ ...data })),
      save: vi.fn((data) =>
        Promise.resolve({ id: 'thread-uuid-1', created_at: new Date(), updated_at: new Date(), ...data }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupEmailThreadService,
        { provide: getRepositoryToken(GroupEmailThread), useValue: threadsRepository },
      ],
    }).compile();

    service = module.get(GroupEmailThreadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByGroupAndUser', () => {
    it('returns null when no thread exists for this group+user pair', async () => {
      threadsRepository.findOne.mockResolvedValue(null);

      const result = await service.findByGroupAndUser(groupId, userId);

      expect(result).toBeNull();
      expect(threadsRepository.findOne).toHaveBeenCalledWith({
        where: { group_id: groupId, user_id: userId },
      });
    });

    it('returns the existing thread when found', async () => {
      const existing = {
        id: 'thread-uuid-1',
        group_id: groupId,
        user_id: userId,
        thread_message_id: messageId,
      };
      threadsRepository.findOne.mockResolvedValue(existing);

      const result = await service.findByGroupAndUser(groupId, userId);

      expect(result).toEqual(existing);
    });
  });

  describe('create', () => {
    it('creates and persists a new thread record', async () => {
      const result = await service.create(groupId, userId, messageId);

      expect(threadsRepository.create).toHaveBeenCalledWith({
        group_id: groupId,
        user_id: userId,
        thread_message_id: messageId,
      });
      expect(threadsRepository.save).toHaveBeenCalled();
      expect(result.group_id).toBe(groupId);
      expect(result.user_id).toBe(userId);
      expect(result.thread_message_id).toBe(messageId);
    });

    it('returns the persisted entity with an id', async () => {
      const result = await service.create(groupId, userId, messageId);
      expect(result.id).toBe('thread-uuid-1');
    });
  });
});
