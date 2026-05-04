import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GoogleAccessTokenService,
  GOOGLE_TOKEN_EXPIRY_BUFFER_MS,
} from './google-access-token.service';
import { UsersService } from '@modules/users/users.service';
import { GoogleTokenExchangeService } from './google-token-exchange.service';
import { User } from '@modules/users/entities/user.entity';

describe('GoogleAccessTokenService', () => {
  let service: GoogleAccessTokenService;
  let usersService: {
    update: ReturnType<typeof vi.fn>;
  };
  let googleTokenExchange: {
    refreshAccessToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    usersService = {
      update: vi.fn().mockResolvedValue(undefined),
    };
    googleTokenExchange = {
      refreshAccessToken: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAccessTokenService,
        { provide: UsersService, useValue: usersService },
        { provide: GoogleTokenExchangeService, useValue: googleTokenExchange },
      ],
    }).compile();

    service = module.get(GoogleAccessTokenService);
  });

  it('returns existing access token when fresh', async () => {
    const future = new Date(Date.now() + GOOGLE_TOKEN_EXPIRY_BUFFER_MS + 60_000);
    const user = {
      id: 'u1',
      google_access_token: 'access',
      token_expires_at: future,
    } as User;

    await expect(service.resolveGoogleAccessToken(user)).resolves.toBe(
      'access',
    );
    expect(googleTokenExchange.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes when access token is near expiry and persists tokens', async () => {
    const soon = new Date(Date.now() + GOOGLE_TOKEN_EXPIRY_BUFFER_MS / 2);
    const user = {
      id: 'u1',
      google_access_token: 'old',
      google_refresh_token: 'refresh',
      token_expires_at: soon,
    } as User;

    googleTokenExchange.refreshAccessToken.mockResolvedValue({
      access_token: 'new-access',
      expiry_date: new Date(Date.now() + 3600_000),
    });

    await expect(service.resolveGoogleAccessToken(user)).resolves.toBe(
      'new-access',
    );

    expect(googleTokenExchange.refreshAccessToken).toHaveBeenCalledWith(
      'refresh',
    );
    expect(usersService.update).toHaveBeenCalledWith('u1', {
      google_access_token: 'new-access',
      token_expires_at: expect.any(Date),
    });
  });

  it('returns null when refresh fails', async () => {
    const soon = new Date(Date.now() + GOOGLE_TOKEN_EXPIRY_BUFFER_MS / 2);
    const user = {
      id: 'u1',
      google_access_token: 'old',
      google_refresh_token: 'refresh',
      token_expires_at: soon,
    } as User;

    googleTokenExchange.refreshAccessToken.mockRejectedValue(new Error('network'));

    await expect(service.resolveGoogleAccessToken(user)).resolves.toBeNull();
  });
});
