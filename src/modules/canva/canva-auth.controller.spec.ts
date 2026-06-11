import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { CanvaAuthController } from './canva-auth.controller';
import { CanvaService } from './canva.service';
import { CanvaOAuthSessionStore } from './canva-oauth-session.store';
import { UsersService } from '@modules/users/users.service';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';

const mockRedirect = vi.fn();
const makeRes = (): Response =>
  ({ redirect: mockRedirect }) as unknown as Response;

const makeReq = (userId: string): Request =>
  ({ user: { id: userId } as JwtRequestUser }) as unknown as Request;

describe('CanvaAuthController', () => {
  let controller: CanvaAuthController;
  let canvaService: {
    generateCodeVerifier: ReturnType<typeof vi.fn>;
    codeChallengeFromVerifier: ReturnType<typeof vi.fn>;
    generateOAuthState: ReturnType<typeof vi.fn>;
    buildAuthorizeUrl: ReturnType<typeof vi.fn>;
    exchangeAuthorizationCode: ReturnType<typeof vi.fn>;
  };
  let sessionStore: {
    setState: ReturnType<typeof vi.fn>;
    take: ReturnType<typeof vi.fn>;
  };
  let usersService: {
    update: ReturnType<typeof vi.fn>;
  };
  let configService: {
    get: ReturnType<typeof vi.fn>;
  };

  const frontendUrl = 'http://localhost:5173';
  const userId = 'user-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(async () => {
    mockRedirect.mockReset();

    canvaService = {
      generateCodeVerifier: vi.fn().mockReturnValue('code-verifier-abc'),
      codeChallengeFromVerifier: vi.fn().mockReturnValue('code-challenge-xyz'),
      generateOAuthState: vi.fn().mockReturnValue('state-123'),
      buildAuthorizeUrl: vi
        .fn()
        .mockReturnValue('https://www.canva.com/api/oauth/authorize?...'),
      exchangeAuthorizationCode: vi.fn().mockResolvedValue({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
      }),
    };
    sessionStore = {
      setState: vi.fn(),
      take: vi
        .fn()
        .mockReturnValue({ userId, codeVerifier: 'code-verifier-abc' }),
    };
    usersService = { update: vi.fn().mockResolvedValue({}) };
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'FRONTEND_URL') return frontendUrl;
        if (key === 'CANVA_REDIRECT_URI')
          return 'http://localhost:3000/auth/canva/callback';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CanvaAuthController],
      providers: [
        { provide: CanvaService, useValue: canvaService },
        { provide: CanvaOAuthSessionStore, useValue: sessionStore },
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<CanvaAuthController>(CanvaAuthController);
  });

  describe('start', () => {
    it('returns an authorizeUrl', () => {
      const result = controller.start(makeReq(userId));

      expect(result).toHaveProperty('authorizeUrl');
      expect(result.authorizeUrl).toContain('canva.com');
    });

    it('stores PKCE session with userId and codeVerifier', () => {
      controller.start(makeReq(userId));

      expect(sessionStore.setState).toHaveBeenCalledWith(
        'state-123',
        userId,
        'code-verifier-abc',
      );
    });

    it('builds the authorize URL from challenge and state', () => {
      controller.start(makeReq(userId));

      expect(canvaService.buildAuthorizeUrl).toHaveBeenCalledWith(
        'code-challenge-xyz',
        'state-123',
      );
    });
  });

  describe('callback', () => {
    it('redirects to success URL when code exchange succeeds', async () => {
      const res = makeRes();

      await controller.callback('auth-code', 'state-123', undefined, res);

      expect(mockRedirect).toHaveBeenCalledWith(
        `${frontendUrl}/canva-connected?success=1`,
      );
    });

    it('updates user tokens on successful exchange', async () => {
      const res = makeRes();

      await controller.callback('auth-code', 'state-123', undefined, res);

      expect(usersService.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          canva_access_token: 'access-token',
          canva_refresh_token: 'refresh-token',
          canva_token_expires_at: expect.any(Date),
        }),
      );
    });

    it('redirects with error when error query param is present', async () => {
      const res = makeRes();

      await controller.callback(undefined, undefined, 'access_denied', res);

      expect(mockRedirect).toHaveBeenCalledWith(
        `${frontendUrl}/canva-connected?error=access_denied`,
      );
    });

    it('redirects with missing_params when code is missing', async () => {
      const res = makeRes();

      await controller.callback(undefined, 'state-123', undefined, res);

      expect(mockRedirect).toHaveBeenCalledWith(
        `${frontendUrl}/canva-connected?error=missing_params`,
      );
    });

    it('redirects with missing_params when state is missing', async () => {
      const res = makeRes();

      await controller.callback('auth-code', undefined, undefined, res);

      expect(mockRedirect).toHaveBeenCalledWith(
        `${frontendUrl}/canva-connected?error=missing_params`,
      );
    });

    it('redirects with invalid_state when session not found', async () => {
      sessionStore.take.mockReturnValue(undefined);
      const res = makeRes();

      await controller.callback('auth-code', 'bad-state', undefined, res);

      expect(mockRedirect).toHaveBeenCalledWith(
        `${frontendUrl}/canva-connected?error=invalid_state`,
      );
    });

    it('redirects with token_exchange_failed when canva returns null tokens', async () => {
      canvaService.exchangeAuthorizationCode.mockResolvedValue(null);
      const res = makeRes();

      await controller.callback('auth-code', 'state-123', undefined, res);

      expect(mockRedirect).toHaveBeenCalledWith(
        `${frontendUrl}/canva-connected?error=token_exchange_failed`,
      );
    });

    it('uses default frontend URL when FRONTEND_URL config is missing', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'CANVA_REDIRECT_URI')
          return 'http://localhost:3000/auth/canva/callback';
        return undefined;
      });
      const res = makeRes();

      await controller.callback('auth-code', 'state-123', undefined, res);

      expect(mockRedirect).toHaveBeenCalledWith(
        'http://localhost:5173/canva-connected?success=1',
      );
    });
  });
});
