import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CanvaService } from './canva.service';

describe('CanvaService', () => {
  let service: CanvaService;

  const configMock = {
    get: vi.fn((key: string) => {
      if (key === 'CANVA_CLIENT_ID') return 'test-client-id';
      if (key === 'CANVA_CLIENT_SECRET') return 'test-secret';
      if (key === 'CANVA_REDIRECT_URI')
        return 'http://localhost:3000/auth/canva/callback';
      return undefined;
    }),
  };

  beforeEach(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        CanvaService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = moduleRef.get(CanvaService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('exchangeAuthorizationCode', () => {
    it('POSTs to token endpoint with authorization_code grant and returns tokens', async () => {
      const fetchMock = vi.mocked(globalThis.fetch);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'at',
            refresh_token: 'rt',
            expires_in: 14400,
            token_type: 'Bearer',
          }),
      } as Response);

      const result = await service.exchangeAuthorizationCode({
        code: 'auth-code',
        codeVerifier: 'verifier-verifier-verifier-verifier-verifier',
        redirectUri:
          'http://localhost:3000/auth/canva/callback',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.canva.com/rest/v1/oauth/token');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      const body = (init.body as string) ?? '';
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('code=auth-code');

      expect(result).toEqual({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 14400,
      });
    });

    it('returns null when token exchange fails', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid_grant'),
        json: () => Promise.resolve({ code: 'invalid_grant' }),
      } as Response);

      const result = await service.exchangeAuthorizationCode({
        code: 'bad',
        codeVerifier: 'verifier-verifier-verifier-verifier-verifier',
        redirectUri: 'http://localhost:3000/auth/canva/callback',
      });

      expect(result).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('POSTs refresh_token grant and returns tokens', async () => {
      const fetchMock = vi.mocked(globalThis.fetch);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-at',
            refresh_token: 'new-rt',
            expires_in: 14400,
          }),
      } as Response);

      const result = await service.refreshAccessToken('old-rt');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = (init.body as string) ?? '';
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain(encodeURIComponent('old-rt'));

      expect(result).toEqual({
        access_token: 'new-at',
        refresh_token: 'new-rt',
        expires_in: 14400,
      });
    });

    it('returns null on failure', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve(''),
      } as Response);

      await expect(service.refreshAccessToken('x')).resolves.toBeNull();
    });
  });

  describe('createPresentation', () => {
    it('POSTs designs endpoint and maps design id and view URL', async () => {
      const fetchMock = vi.mocked(globalThis.fetch);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            design: {
              id: 'DA123',
              urls: {
                view_url: 'https://www.canva.com/view',
                edit_url: 'https://www.canva.com/edit',
              },
            },
          }),
      } as Response);

      const result = await service.createPresentation('token', 'My Group');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.canva.com/rest/v1/designs');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>).Authorization).toBe(
        'Bearer token',
      );
      const parsed = JSON.parse(init.body as string);
      expect(parsed.title).toBe('My Group');
      expect(parsed.design_type).toEqual({
        type: 'preset',
        name: 'presentation',
      });

      expect(result).toEqual({
        designId: 'DA123',
        viewUrl: 'https://www.canva.com/view',
        editUrl: 'https://www.canva.com/edit',
      });
    });

    it('returns null when API errors', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve(''),
      } as Response);

      await expect(
        service.createPresentation('t', 'Title'),
      ).resolves.toBeNull();
    });
  });
});
