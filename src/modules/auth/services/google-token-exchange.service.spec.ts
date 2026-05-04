import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import {
  GoogleTokenExchangeService,
  GoogleUserProfile,
} from './google-token-exchange.service';

// Mock OAuth2Client
vi.mock('google-auth-library');

describe('GoogleTokenExchangeService', () => {
  let service: GoogleTokenExchangeService;
  let configService: ConfigService;
  let mockOAuth2Client: any;

  beforeEach(async () => {
    mockOAuth2Client = {
      getToken: vi.fn(),
      verifyIdToken: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleTokenExchangeService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              const config: Record<string, string> = {
                GOOGLE_CLIENT_ID: 'test-client-id',
                GOOGLE_CLIENT_SECRET: 'test-client-secret',
                GOOGLE_CALLBACK_URL:
                  'http://localhost:3000/auth/google/callback',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GoogleTokenExchangeService>(
      GoogleTokenExchangeService,
    );
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exchangeCodeAndVerify', () => {
    const validCode = 'valid-auth-code';
    const validCodeVerifier = 'valid-code-verifier';

    const mockTokenResponse = {
      tokens: {
        access_token: 'google-access-token',
        refresh_token: 'google-refresh-token',
        id_token: 'valid.id.token',
        expiry_date: Date.now() + 3600000, // 1 hour from now
      },
    };

    const mockIdTokenPayload: Partial<TokenPayload> = {
      email: 'user@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
      aud: 'test-client-id',
      iss: 'https://accounts.google.com',
      sub: '123456789',
    };

    it('should successfully exchange code and return user profile', async () => {
      // Setup mocks
      mockOAuth2Client.getToken = vi.fn().mockResolvedValue(mockTokenResponse);
      mockOAuth2Client.verifyIdToken = vi.fn().mockResolvedValue({
        getPayload: () => mockIdTokenPayload,
      });

      (service as any).oauth2Client = mockOAuth2Client;

      // Execute
      const result = await service.exchangeCodeAndVerify(
        validCode,
        validCodeVerifier,
      );

      // Assert
      expect(result).toEqual({
        email: 'user@example.com',
        full_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        google_access_token: 'google-access-token',
        google_refresh_token: 'google-refresh-token',
        token_expires_at: new Date(mockTokenResponse.tokens.expiry_date),
      } as GoogleUserProfile);

      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith({
        code: validCode,
        codeVerifier: validCodeVerifier,
      });
    });

    it('should handle missing email in ID token', async () => {
      const payloadWithoutEmail = { ...mockIdTokenPayload, email: undefined };

      (service as any).oauth2Client = mockOAuth2Client;
      mockOAuth2Client.getToken = vi.fn().mockResolvedValue(mockTokenResponse);
      mockOAuth2Client.verifyIdToken = vi.fn().mockResolvedValue({
        getPayload: () => payloadWithoutEmail,
      });

      // Execute & Assert
      await expect(
        service.exchangeCodeAndVerify(validCode, validCodeVerifier),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle missing ID token from Google', async () => {
      const tokenResponseWithoutIdToken = {
        tokens: {
          access_token: 'google-access-token',
          refresh_token: 'google-refresh-token',
          id_token: undefined,
        },
      };

      (service as any).oauth2Client = mockOAuth2Client;
      mockOAuth2Client.getToken = vi
        .fn()
        .mockResolvedValue(tokenResponseWithoutIdToken);

      // Execute & Assert
      await expect(
        service.exchangeCodeAndVerify(validCode, validCodeVerifier),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle invalid_grant error (code already redeemed)', async () => {
      (service as any).oauth2Client = mockOAuth2Client;
      mockOAuth2Client.getToken = vi
        .fn()
        .mockRejectedValue(new Error('invalid_grant: code already redeemed'));

      // Execute & Assert
      await expect(
        service.exchangeCodeAndVerify(validCode, validCodeVerifier),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle invalid code verifier (PKCE mismatch)', async () => {
      (service as any).oauth2Client = mockOAuth2Client;
      mockOAuth2Client.getToken = vi
        .fn()
        .mockRejectedValue(new Error('invalid_code_verifier'));

      // Execute & Assert
      await expect(
        service.exchangeCodeAndVerify(validCode, validCodeVerifier),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle missing refresh_token (optional for public clients)', async () => {
      const tokenResponseNoRefreshToken = {
        tokens: {
          access_token: 'google-access-token',
          refresh_token: null,
          id_token: 'valid.id.token',
          expiry_date: Date.now() + 3600000,
        },
      };

      (service as any).oauth2Client = mockOAuth2Client;
      mockOAuth2Client.getToken = vi
        .fn()
        .mockResolvedValue(tokenResponseNoRefreshToken);
      mockOAuth2Client.verifyIdToken = vi.fn().mockResolvedValue({
        getPayload: () => mockIdTokenPayload,
      });

      // Execute
      const result = await service.exchangeCodeAndVerify(
        validCode,
        validCodeVerifier,
      );

      // Assert
      expect(result.google_refresh_token).toBeUndefined();
    });

    it('should handle generic Google API error', async () => {
      (service as any).oauth2Client = mockOAuth2Client;
      mockOAuth2Client.getToken = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));

      // Execute & Assert
      await expect(
        service.exchangeCodeAndVerify(validCode, validCodeVerifier),
      ).rejects.toThrow(Error);
    });

    it('should use default full_name if not provided by Google', async () => {
      const payloadWithoutName = { ...mockIdTokenPayload, name: undefined };

      (service as any).oauth2Client = mockOAuth2Client;
      mockOAuth2Client.getToken = vi.fn().mockResolvedValue(mockTokenResponse);
      mockOAuth2Client.verifyIdToken = vi.fn().mockResolvedValue({
        getPayload: () => payloadWithoutName,
      });

      // Execute
      const result = await service.exchangeCodeAndVerify(
        validCode,
        validCodeVerifier,
      );

      // Assert
      expect(result.full_name).toBe('Google User');
    });
  });

  describe('initialization', () => {
    it('should throw error if GOOGLE_CLIENT_ID is missing', () => {
      const mockConfigService = {
        get: vi.fn((key: string) => {
          const config: Record<string, string> = {
            GOOGLE_CLIENT_SECRET: 'secret',
            GOOGLE_CALLBACK_URL: 'http://localhost:3000/callback',
          };
          return config[key];
        }),
      };

      expect(() => {
        new GoogleTokenExchangeService(mockConfigService as any);
      }).toThrow();
    });

    it('should throw error if GOOGLE_CLIENT_SECRET is missing', () => {
      const mockConfigService = {
        get: vi.fn((key: string) => {
          const config: Record<string, string> = {
            GOOGLE_CLIENT_ID: 'client-id',
            GOOGLE_CALLBACK_URL: 'http://localhost:3000/callback',
          };
          return config[key];
        }),
      };

      expect(() => {
        new GoogleTokenExchangeService(mockConfigService as any);
      }).toThrow();
    });
  });
});
