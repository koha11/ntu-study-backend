import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleCallbackResponseDto } from './dto';
import type { LoginResponseDto } from './dto/login-response.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

  const mockLoginResponse: LoginResponseDto = {
    access_token: 'access',
    refresh_token: 'refresh',
  };

  beforeEach(async () => {
    authService = {
      googleAuth: vi.fn(),
      validateUser: vi.fn(),
      login: vi.fn(),
      loginByUserId: vi.fn(),
      refreshToken: vi.fn(),
      logout: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /auth/google/callback', () => {
    describe('googleCallbackPostFlow', () => {
      const validQuery = {
        code: 'valid-auth-code',
        code_verifier: 'valid-code-verifier',
      };

      it('should return JWT tokens on successful code exchange', async () => {
        authService.googleAuth.mockResolvedValue(mockUserId);
        authService.loginByUserId.mockResolvedValue(mockLoginResponse);

        const result = await controller.googleCallbackPostFlow(validQuery);

        expect(result).toEqual(mockLoginResponse);
        expect(authService.googleAuth).toHaveBeenCalledWith(validQuery);
        expect(authService.loginByUserId).toHaveBeenCalledWith(mockUserId);
      });

      it('should throw BadRequestException when code is missing', async () => {
        const queryWithoutCode = { code_verifier: 'verifier' };

        await expect(
          controller.googleCallbackPostFlow(queryWithoutCode),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when code_verifier is missing', async () => {
        const queryWithoutVerifier = { code: 'code' };

        await expect(
          controller.googleCallbackPostFlow(queryWithoutVerifier),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when both parameters are missing', async () => {
        const emptyQuery = {};

        await expect(
          controller.googleCallbackPostFlow(emptyQuery),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when code is empty string', async () => {
        const queryWithEmptyCode = {
          code: '',
          code_verifier: 'verifier',
        };

        await expect(
          controller.googleCallbackPostFlow(queryWithEmptyCode),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when code_verifier is empty string', async () => {
        const queryWithEmptyVerifier = {
          code: 'code',
          code_verifier: '',
        };

        await expect(
          controller.googleCallbackPostFlow(queryWithEmptyVerifier),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when code is not a string', async () => {
        const queryWithNonStringCode = {
          code: 12345,
          code_verifier: 'verifier',
        };

        await expect(
          controller.googleCallbackPostFlow(queryWithNonStringCode),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when code_verifier is not a string', async () => {
        const queryWithNonStringVerifier = {
          code: 'code',
          code_verifier: { nested: 'object' },
        };

        await expect(
          controller.googleCallbackPostFlow(queryWithNonStringVerifier),
        ).rejects.toThrow(BadRequestException);
      });

      it('should re-throw UnauthorizedException from AuthService', async () => {
        authService.googleAuth.mockRejectedValue(
          new UnauthorizedException('Invalid authorization code'),
        );

        await expect(
          controller.googleCallbackPostFlow(validQuery),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('should re-throw other exceptions from AuthService', async () => {
        const serverError = new Error('Internal server error');
        authService.googleAuth.mockRejectedValue(serverError);

        await expect(
          controller.googleCallbackPostFlow(validQuery),
        ).rejects.toThrow(serverError);
      });

      it('should handle code with special characters', async () => {
        const specialQuery = {
          code: 'code-with-special_chars.slash/back\\slash',
          code_verifier: 'verifier-with_special.chars',
        };

        authService.googleAuth.mockResolvedValue(mockUserId);
        authService.loginByUserId.mockResolvedValue(mockLoginResponse);

        const result = await controller.googleCallbackPostFlow(specialQuery);

        expect(result).toEqual(mockLoginResponse);
        expect(authService.googleAuth).toHaveBeenCalledWith(specialQuery);
      });

      it('should handle long code strings', async () => {
        const longCode = 'a'.repeat(1000);
        const longVerifier = 'b'.repeat(1000);

        authService.googleAuth.mockResolvedValue(mockUserId);
        authService.loginByUserId.mockResolvedValue(mockLoginResponse);

        const result = await controller.googleCallbackPostFlow({
          code: longCode,
          code_verifier: longVerifier,
        });

        expect(result).toEqual(mockLoginResponse);
      });

      it('should handle whitespace in code parameters', async () => {
        const queryWithWhitespace = {
          code: '  code-with-spaces  ',
          code_verifier: '  verifier-with-spaces  ',
        };

        authService.googleAuth.mockResolvedValue(mockUserId);
        authService.loginByUserId.mockResolvedValue(mockLoginResponse);

        // Note: trimming should be done at service level if needed
        const result =
          await controller.googleCallbackPostFlow(queryWithWhitespace);

        expect(result).toEqual(mockLoginResponse);
      });

      it('should pass exact query parameters to AuthService', async () => {
        const query = {
          code: 'exact-code',
          code_verifier: 'exact-verifier',
        };

        authService.googleAuth.mockResolvedValue(mockUserId);
        authService.loginByUserId.mockResolvedValue(mockLoginResponse);

        await controller.googleCallbackPostFlow(query);

        expect(authService.googleAuth).toHaveBeenCalledWith(query);
        expect(authService.loginByUserId).toHaveBeenCalledWith(mockUserId);
      });
    });
  });

  describe('GET /auth/google/callback (Passport flow)', () => {
    describe('googleAuthCallbackRedirect', () => {
      it('should return user_id when authenticated', async () => {
        const mockRequest = {
          user: { id: mockUserId, email: 'user@example.com' },
        };

        const result = controller.googleAuthCallbackRedirect(mockRequest);

        expect(result).toEqual<GoogleCallbackResponseDto>({
          user_id: mockUserId,
        });
      });

      it('should throw error when user_id is missing from request', async () => {
        const mockRequest = {
          user: { email: 'user@example.com' }, // No id
        };

        expect(() =>
          controller.googleAuthCallbackRedirect(mockRequest),
        ).toThrow('User ID not found in authenticated request');
      });

      it('should throw error when user object is missing', async () => {
        const mockRequest = {}; // No user

        expect(() =>
          controller.googleAuthCallbackRedirect(mockRequest),
        ).toThrow('User ID not found in authenticated request');
      });

      it('should throw error when user is null', async () => {
        const mockRequest = { user: null };

        expect(() =>
          controller.googleAuthCallbackRedirect(mockRequest),
        ).toThrow('User ID not found in authenticated request');
      });
    });
  });

  describe('GET /auth/google', () => {
    describe('googleAuth', () => {
      it('should be defined', () => {
        expect(controller.googleAuth).toBeDefined();
      });

      // GoogleAuthGuard handles the redirect, controller is just stub
    });
  });

  describe('POST /auth/refresh', () => {
    describe('refreshToken', () => {
      it('should be defined', () => {
        expect(controller.refreshToken).toBeDefined();
      });
    });
  });

  describe('GET /auth/verify', () => {
    describe('verify', () => {
      it('should return valid payload with sub and email when user is authenticated', () => {
        const req = {
          user: {
            id: mockUserId,
            email: 'user@example.com',
          },
        };

        expect(controller.verify(req)).toEqual({
          valid: true,
          sub: mockUserId,
          email: 'user@example.com',
        });
      });

      it('should return valid payload with sub only when email is absent', () => {
        const req = { user: { id: mockUserId } };

        expect(controller.verify(req)).toEqual({
          valid: true,
          sub: mockUserId,
        });
      });
    });
  });

  describe('POST /auth/logout', () => {
    describe('logout', () => {
      it('should call authService.logout with request user', async () => {
        const req = { user: { id: mockUserId } };
        authService.logout.mockResolvedValue(undefined);

        const result = await controller.logout(req);

        expect(authService.logout).toHaveBeenCalledWith(req.user);
        expect(result).toEqual({ message: 'Logged out' });
      });
    });
  });
});
