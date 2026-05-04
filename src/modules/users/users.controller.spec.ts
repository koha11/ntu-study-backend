import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { GoogleAccessTokenService } from '@modules/auth/services/google-access-token.service';
import { UserRole } from '@common/enums';
import type { User } from './entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    findOne: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let googleAccessTokenService: {
    resolveGoogleAccessToken: ReturnType<typeof vi.fn>;
  };

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

  const baseMockUser = {
    id: mockUserId,
    email: 'user@example.com',
    full_name: 'Test User',
    avatar_url: 'https://example.com/a.jpg',
    role: UserRole.USER,
    notification_enabled: true,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-02'),
  } as User;

  const mockUser = {
    ...baseMockUser,
    canva_access_token: undefined,
    canva_refresh_token: undefined,
  } as User;

  beforeEach(async () => {
    usersService = {
      findOne: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    };

    googleAccessTokenService = {
      resolveGoogleAccessToken: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        {
          provide: GoogleAccessTokenService,
          useValue: googleAccessTokenService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /users/me', () => {
    describe('getProfile', () => {
      it('should return profile for authenticated user', async () => {
        usersService.findOne.mockResolvedValue(mockUser);

        const result = await controller.getProfile({
          user: { id: mockUserId },
        });

        expect(usersService.findOne).toHaveBeenCalledWith(mockUserId);
        expect(result).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          full_name: mockUser.full_name,
          avatar_url: mockUser.avatar_url,
          role: mockUser.role,
          notification_enabled: true,
          canva_connected: false,
          drive_total_quota: null,
          created_at: mockUser.created_at,
          updated_at: mockUser.updated_at,
        });
      });

      it('should set canva_connected true when user has Canva tokens', async () => {
        const withCanva = {
          ...mockUser,
          canva_access_token: 'at',
          canva_refresh_token: undefined,
        } as User;
        usersService.findOne.mockResolvedValue(withCanva);

        const result = await controller.getProfile({
          user: { id: mockUserId },
        });

        expect(result.canva_connected).toBe(true);
        expect(result.notification_enabled).toBe(true);
      });

      it('should set canva_connected true when only refresh token is set', async () => {
        const withCanva = {
          ...mockUser,
          canva_access_token: undefined,
          canva_refresh_token: 'rt',
        } as User;
        usersService.findOne.mockResolvedValue(withCanva);

        const result = await controller.getProfile({
          user: { id: mockUserId },
        });

        expect(result.canva_connected).toBe(true);
      });

      it('should throw NotFoundException when user does not exist', async () => {
        usersService.findOne.mockResolvedValue(null);

        await expect(
          controller.getProfile({ user: { id: mockUserId } }),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('PATCH /users/me', () => {
    describe('updateProfile', () => {
      it('should apply partial updates and return updated profile', async () => {
        const updated = {
          ...mockUser,
          full_name: 'New Name',
        };
        usersService.update.mockResolvedValue(updated);
        usersService.findOne.mockResolvedValue(updated);

        const result = await controller.updateProfile(
          { user: { id: mockUserId } },
          { full_name: 'New Name' },
        );

        expect(usersService.update).toHaveBeenCalledWith(mockUserId, {
          full_name: 'New Name',
        });
        expect(result.full_name).toBe('New Name');
        expect(result.notification_enabled).toBe(true);
        expect(result.canva_connected).toBe(false);
      });

      it('should apply notification_enabled and return it in profile', async () => {
        const updated = {
          ...mockUser,
          notification_enabled: false,
        };
        usersService.update.mockResolvedValue(updated);
        usersService.findOne.mockResolvedValue(updated);

        const result = await controller.updateProfile(
          { user: { id: mockUserId } },
          { notification_enabled: false },
        );

        expect(usersService.update).toHaveBeenCalledWith(mockUserId, {
          notification_enabled: false,
        });
        expect(result.notification_enabled).toBe(false);
      });

      it('should skip update when body is empty', async () => {
        usersService.findOne.mockResolvedValue(mockUser);

        await controller.updateProfile({ user: { id: mockUserId } }, {});

        expect(usersService.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('POST /users/me/google-profile/sync', () => {
    it('updates full_name and avatar_url from Google userinfo', async () => {
      const withGoogle: User = {
        ...mockUser,
        google_access_token: 'acc',
        google_refresh_token: 'ref',
      };
      usersService.findById.mockResolvedValue(withGoogle);
      googleAccessTokenService.resolveGoogleAccessToken.mockResolvedValue(
        'google-at',
      );
      usersService.update.mockResolvedValue(withGoogle);
      const afterSync = {
        ...withGoogle,
        full_name: 'From Google',
        avatar_url: 'https://google/pic.png',
      };
      usersService.findOne.mockResolvedValue(afterSync);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              name: 'From Google',
              picture: 'https://google/pic.png',
            }),
        }),
      );

      const result = await controller.syncGoogleProfile({
        user: { id: mockUserId },
      });

      expect(usersService.update).toHaveBeenCalledWith(mockUserId, {
        full_name: 'From Google',
        avatar_url: 'https://google/pic.png',
      });
      expect(result.full_name).toBe('From Google');
      expect(result.avatar_url).toBe('https://google/pic.png');

      vi.unstubAllGlobals();
    });

    it('throws BadRequest when Google access token cannot be resolved', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      googleAccessTokenService.resolveGoogleAccessToken.mockResolvedValue(null);

      await expect(
        controller.syncGoogleProfile({ user: { id: mockUserId } }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
