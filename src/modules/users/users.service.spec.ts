import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { User } from '@modules/users/entities/user.entity';
import { UsersService } from './users.service';
import { UserRole } from '@common/enums';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserRepository: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    increment: ReturnType<typeof vi.fn>;
  };

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    role: UserRole.USER,
    google_access_token: 'access-token',
    google_refresh_token: 'refresh-token',
    token_expires_at: new Date(Date.now() + 3600000),
    is_active: true,
    notification_enabled: true,
    last_login_at: new Date(),
    refresh_token_version: 0,
    created_at: new Date(),
    updated_at: new Date(),
  } as User;

  beforeEach(async () => {
    mockUserRepository = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      increment: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findOne', () => {
    it('should return user when found by id', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user with hidden fields when requested', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id, true);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: [
          'id',
          'email',
          'full_name',
          'avatar_url',
          'role',
          'google_access_token',
          'google_refresh_token',
          'token_expires_at',
          'drive_total_quota',
          'drive_used_quota',
          'quota_last_updated',
          'is_active',
          'notification_enabled',
          'last_login_at',
          'canva_access_token',
          'canva_refresh_token',
          'canva_token_expires_at',
          'created_at',
          'updated_at',
        ],
      });
    });

    it('should return user without hidden fields by default', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id);

      expect(result).not.toHaveProperty('hashed_refresh_token');
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail(mockUser.email);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockUser.email },
      });
    });

    it('should return null when user not found by email', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should be case-sensitive for email lookup', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await service.findByEmail('USER@EXAMPLE.COM');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'USER@EXAMPLE.COM' },
      });
    });
  });

  describe('create', () => {
    it('should create and return new user', async () => {
      const newUserData: Partial<User> = {
        email: 'newuser@example.com',
        full_name: 'New User',
        role: UserRole.USER,
        is_active: true,
      };

      mockUserRepository.create.mockReturnValue(newUserData as User);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        ...newUserData,
      });

      const result = await service.create(newUserData);

      expect(mockUserRepository.create).toHaveBeenCalledWith(newUserData);
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result.email).toBe(newUserData.email);
    });

    it('should create user with default values', async () => {
      const minimalUserData: Partial<User> = {
        email: 'user@example.com',
        full_name: 'User',
      };

      mockUserRepository.create.mockReturnValue(minimalUserData as User);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        ...minimalUserData,
      });

      const result = await service.create(minimalUserData);

      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('full_name');
    });

    it('should handle database errors during create', async () => {
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.create(mockUser)).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    it('should update and return user', async () => {
      const updateData: Partial<User> = {
        last_login_at: new Date(),
        google_access_token: 'new-access-token',
      };

      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        ...updateData,
      });

      const result = await service.update(mockUser.id, updateData);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        updateData,
      );
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(result).toEqual({ ...mockUser, ...updateData });
    });

    it('should throw error when user not found after update', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(mockUser.id, { last_login_at: new Date() }),
      ).rejects.toThrow(`User with id ${mockUser.id} not found after update`);
    });

    it('should handle partial updates', async () => {
      const partialUpdate: Partial<User> = {
        avatar_url: 'https://new-avatar.jpg',
      };

      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        ...partialUpdate,
      });

      const result = await service.update(mockUser.id, partialUpdate);

      expect(result.avatar_url).toBe(partialUpdate.avatar_url);
      expect(result.email).toBe(mockUser.email); // Unchanged fields preserved
    });
  });

  describe('updateLastLogin', () => {
    it('should update last_login_at timestamp', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateLastLogin(mockUser.id);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          last_login_at: expect.any(Date),
        }),
      );
    });

    it('should set last_login_at to current time', async () => {
      const beforeUpdate = new Date();
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateLastLogin(mockUser.id);

      const callArgs = mockUserRepository.update.mock.calls[0][1];
      expect(callArgs.last_login_at.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
    });
  });

  describe('incrementRefreshTokenVersion', () => {
    it('should increment refresh_token_version by 1', async () => {
      await service.incrementRefreshTokenVersion(mockUser.id);

      expect(mockUserRepository.increment).toHaveBeenCalledWith(
        { id: mockUser.id },
        'refresh_token_version',
        1,
      );
    });
  });

  describe('updateRefreshToken', () => {
    it('is a no-op; revocation uses refresh_token_version', async () => {
      await service.updateRefreshToken(mockUser.id, 'ignored');
      await service.updateRefreshToken(mockUser.id, null);

      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('updateDriveQuota', () => {
    it('persists quota bytes and timestamp', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as never);

      await service.updateDriveQuota(mockUser.id, '16000', '9000');

      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, {
        drive_total_quota: '16000',
        drive_used_quota: '9000',
        quota_last_updated: expect.any(Date),
      });
    });
  });

  describe('updateDriveUsedQuota', () => {
    it('updates measured usage and timestamp only', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as never);

      await service.updateDriveUsedQuota(mockUser.id, '9000');

      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, {
        drive_used_quota: '9000',
        quota_last_updated: expect.any(Date),
      });
    });
  });

  describe('error handling', () => {
    it('should propagate repository errors', async () => {
      const dbError = new Error('Database connection error');
      mockUserRepository.findOne.mockRejectedValue(dbError);

      await expect(service.findOne(mockUser.id)).rejects.toThrow(dbError);
    });
  });
});
