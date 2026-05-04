import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { UsersService } from '@modules/users/users.service';
import { GoogleTokenExchangeService } from './services/google-token-exchange.service';
import { UserRole } from '@common/enums';
import { User } from '@modules/users/entities/user.entity';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateLastLogin: ReturnType<typeof vi.fn>;
    incrementRefreshTokenVersion: ReturnType<typeof vi.fn>;
  };
  let googleTokenExchange: { exchangeCodeAndVerify: ReturnType<typeof vi.fn> };
  let jwtService: {
    signAsync: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
  };
  let configService: { get: ReturnType<typeof vi.fn> };

  const mockGoogleProfile = {
    email: 'user@example.com',
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    google_access_token: 'google-access-token',
    google_refresh_token: 'google-refresh-token',
    token_expires_at: new Date(Date.now() + 3600000),
  };

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: mockGoogleProfile.email,
    full_name: mockGoogleProfile.full_name,
    avatar_url: mockGoogleProfile.avatar_url,
    role: UserRole.USER,
    google_access_token: mockGoogleProfile.google_access_token,
    google_refresh_token: mockGoogleProfile.google_refresh_token,
    token_expires_at: mockGoogleProfile.token_expires_at,
    is_active: true,
    notification_enabled: true,
    last_login_at: new Date(),
    refresh_token_version: 0,
    created_at: new Date(),
    updated_at: new Date(),
  } as User;

  beforeEach(async () => {
    usersService = {
      findByEmail: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateLastLogin: vi.fn(),
      incrementRefreshTokenVersion: vi.fn(),
    };

    googleTokenExchange = {
      exchangeCodeAndVerify: vi.fn(),
    };

    jwtService = {
      signAsync: vi
        .fn()
        .mockImplementation((payload) =>
          Promise.resolve(
            `signed-${typeof payload === 'object' && payload && 'sub' in payload ? (payload as { sub: string }).sub : 'x'}`,
          ),
        ),
      verify: vi
        .fn()
        .mockReturnValue({ sub: mockUser.id, rv: mockUser.refresh_token_version }),
    };

    configService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        if (key === 'JWT_EXPIRATION') return 3600;
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_REFRESH_EXPIRATION_SECONDS') return 604800;
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: GoogleTokenExchangeService,
          useValue: googleTokenExchange,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('googleAuth', () => {
    const authPayload = {
      code: 'valid-auth-code',
      code_verifier: 'valid-code-verifier',
    };

    describe('existing user flow', () => {
      it('should return user_id for existing user', async () => {
        // Setup mocks
        googleTokenExchange.exchangeCodeAndVerify.mockResolvedValue(
          mockGoogleProfile,
        );
        usersService.findByEmail.mockResolvedValue(mockUser);
        usersService.update.mockResolvedValue(mockUser);

        // Execute
        const result = await authService.googleAuth(authPayload);

        // Assert
        expect(result).toBe(mockUser.id);
        expect(googleTokenExchange.exchangeCodeAndVerify).toHaveBeenCalledWith(
          authPayload.code,
          authPayload.code_verifier,
        );
        expect(usersService.findByEmail).toHaveBeenCalledWith(
          mockGoogleProfile.email,
        );
        expect(usersService.update).toHaveBeenCalledWith(mockUser.id, {
          google_access_token: mockGoogleProfile.google_access_token,
          google_refresh_token: mockGoogleProfile.google_refresh_token,
          token_expires_at: mockGoogleProfile.token_expires_at,
          avatar_url: mockGoogleProfile.avatar_url,
          last_login_at: expect.any(Date),
        });
        expect(usersService.create).not.toHaveBeenCalled();
      });

      it('should update user tokens and last_login_at for existing user', async () => {
        googleTokenExchange.exchangeCodeAndVerify.mockResolvedValue(
          mockGoogleProfile,
        );
        usersService.findByEmail.mockResolvedValue(mockUser);
        usersService.update.mockResolvedValue(mockUser);

        await authService.googleAuth(authPayload);

        const updateCall = usersService.update.mock.calls[0];
        expect(updateCall[1]).toHaveProperty('last_login_at');
        expect(updateCall[1].last_login_at).toBeInstanceOf(Date);
      });
    });

    describe('new user flow', () => {
      it('should create new user with default values', async () => {
        const newUser = { ...mockUser, id: 'new-user-id' };

        googleTokenExchange.exchangeCodeAndVerify.mockResolvedValue(
          mockGoogleProfile,
        );
        usersService.findByEmail.mockResolvedValue(null); // User doesn't exist
        usersService.create.mockResolvedValue(newUser);

        // Execute
        const result = await authService.googleAuth(authPayload);

        // Assert
        expect(result).toBe(newUser.id);
        expect(usersService.findByEmail).toHaveBeenCalledWith(
          mockGoogleProfile.email,
        );
        expect(usersService.create).toHaveBeenCalledWith({
          email: mockGoogleProfile.email,
          full_name: mockGoogleProfile.full_name,
          avatar_url: mockGoogleProfile.avatar_url,
          google_access_token: mockGoogleProfile.google_access_token,
          google_refresh_token: mockGoogleProfile.google_refresh_token,
          token_expires_at: mockGoogleProfile.token_expires_at,
          role: UserRole.USER,
          is_active: true,
          notification_enabled: true,
          last_login_at: expect.any(Date),
        });
        expect(usersService.update).not.toHaveBeenCalled();
      });

      it('should create user with USER role and active status', async () => {
        const newUser = { ...mockUser };
        googleTokenExchange.exchangeCodeAndVerify.mockResolvedValue(
          mockGoogleProfile,
        );
        usersService.findByEmail.mockResolvedValue(null);
        usersService.create.mockResolvedValue(newUser);

        await authService.googleAuth(authPayload);

        const createCall = usersService.create.mock.calls[0][0];
        expect(createCall.role).toBe(UserRole.USER);
        expect(createCall.is_active).toBe(true);
        expect(createCall.notification_enabled).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should re-throw UnauthorizedException from google token exchange', async () => {
        const authError = new UnauthorizedException('Invalid code');
        googleTokenExchange.exchangeCodeAndVerify.mockRejectedValue(authError);

        await expect(authService.googleAuth(authPayload)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should wrap other errors as InternalServerErrorException', async () => {
        const dbError = new Error('Database connection failed');
        googleTokenExchange.exchangeCodeAndVerify.mockResolvedValue(
          mockGoogleProfile,
        );
        usersService.findByEmail.mockRejectedValue(dbError);

        await expect(authService.googleAuth(authPayload)).rejects.toThrow(
          InternalServerErrorException,
        );
      });

      it('should handle errors during user creation', async () => {
        const createError = new Error('Unique constraint violation');
        googleTokenExchange.exchangeCodeAndVerify.mockResolvedValue(
          mockGoogleProfile,
        );
        usersService.findByEmail.mockResolvedValue(null);
        usersService.create.mockRejectedValue(createError);

        await expect(authService.googleAuth(authPayload)).rejects.toThrow(
          InternalServerErrorException,
        );
      });

      it('should handle errors during user update', async () => {
        const updateError = new Error('Update failed');
        googleTokenExchange.exchangeCodeAndVerify.mockResolvedValue(
          mockGoogleProfile,
        );
        usersService.findByEmail.mockResolvedValue(mockUser);
        usersService.update.mockRejectedValue(updateError);

        await expect(authService.googleAuth(authPayload)).rejects.toThrow(
          InternalServerErrorException,
        );
      });

      it('should include error message in InternalServerErrorException', async () => {
        const errorMessage = 'Specific error message';
        googleTokenExchange.exchangeCodeAndVerify.mockRejectedValue(
          new Error(errorMessage),
        );

        try {
          await authService.googleAuth(authPayload);
          fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(InternalServerErrorException);
          expect((error as any).message).toContain(errorMessage);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle profile with optional fields missing', async () => {
        const profileWithoutOptional = {
          ...mockGoogleProfile,
          avatar_url: undefined,
          google_refresh_token: undefined,
        };

        const newUser = { ...mockUser, id: 'new-user-id' };
        googleTokenExchange.exchangeCodeAndVerify.mockResolvedValue(
          profileWithoutOptional,
        );
        usersService.findByEmail.mockResolvedValue(null);
        usersService.create.mockResolvedValue(newUser);

        const result = await authService.googleAuth(authPayload);

        expect(result).toBe(newUser.id);
        const createCall = usersService.create.mock.calls[0][0];
        expect(createCall.avatar_url).toBeUndefined();
        expect(createCall.google_refresh_token).toBeUndefined();
      });

      it('should preserve user ID across multiple logins', async () => {
        googleTokenExchange.exchangeCodeAndVerify.mockResolvedValue(
          mockGoogleProfile,
        );
        usersService.findByEmail.mockResolvedValue(mockUser);
        usersService.update.mockResolvedValue(mockUser);

        // First login
        const result1 = await authService.googleAuth(authPayload);

        // Second login
        const result2 = await authService.googleAuth(authPayload);

        expect(result1).toBe(result2);
        expect(result1).toBe(mockUser.id);
      });
    });
  });

  describe('login', () => {
    it('should issue access and refresh tokens', async () => {
      usersService.findOne.mockResolvedValue(mockUser);

      const result = await authService.login({
        id: mockUser.id,
        email: mockUser.email,
      });

      expect(usersService.findOne).toHaveBeenCalledWith(mockUser.id);
      expect(result.access_token).toMatch(/^signed-/);
      expect(result.refresh_token).toMatch(/^signed-/);
    });

    it('should include role in access token JWT payload', async () => {
      usersService.findOne.mockResolvedValue(mockUser);

      await authService.login({
        id: mockUser.id,
        email: mockUser.email,
      });

      const accessCall = jwtService.signAsync.mock.calls[0];
      expect(accessCall[0]).toMatchObject({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });
  });

  describe('logout', () => {
    it('should increment refresh token version', async () => {
      await authService.logout({ id: mockUser.id });

      expect(usersService.incrementRefreshTokenVersion).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe('refreshToken', () => {
    it('should verify refresh JWT and issue new tokens', async () => {
      usersService.findOne.mockResolvedValue(mockUser);

      const result = await authService.refreshToken('incoming-refresh-jwt');

      expect(jwtService.verify).toHaveBeenCalled();
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
    });

    it('should reject when refresh rv does not match user session version', async () => {
      jwtService.verify.mockReturnValueOnce({
        sub: mockUser.id,
        rv: 0,
      });
      usersService.findOne.mockResolvedValue({
        ...mockUser,
        refresh_token_version: 1,
      });

      await expect(
        authService.refreshToken('incoming-refresh-jwt'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
