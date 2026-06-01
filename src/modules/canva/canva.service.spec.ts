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
        redirectUri: 'http://localhost:3000/auth/canva/callback',
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
      expect(parsed.type).toBe('type_and_asset');
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

    it('returns null when design id or view_url is missing', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ design: { id: 'DA1' } }),
      } as Response);

      await expect(service.createPresentation('t', 'Title')).resolves.toBeNull();
    });

    it('returns null when fetch throws', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(service.createPresentation('t', 'Title')).resolves.toBeNull();
    });

    it('omits editUrl when not present in response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          design: { id: 'DA2', urls: { view_url: 'https://canva.com/view' } },
        }),
      } as Response);

      const result = await service.createPresentation('t', 'No Edit');
      expect(result?.editUrl).toBeUndefined();
      expect(result?.designId).toBe('DA2');
    });
  });

  describe('buildAuthorizeUrl', () => {
    it('returns authorize URL with required params', () => {
      const url = service.buildAuthorizeUrl('challenge-xyz', 'state-abc');
      expect(url).toContain('https://www.canva.com/api/oauth/authorize');
      expect(url).toContain('code_challenge=challenge-xyz');
      expect(url).toContain('state=state-abc');
      expect(url).toContain('client_id=test-client-id');
    });

    it('throws when CANVA_CLIENT_ID is missing', () => {
      const badConfig = {
        get: vi.fn((key: string) => {
          if (key === 'CANVA_REDIRECT_URI') return 'http://localhost/callback';
          return undefined;
        }),
      };
      const badService = new CanvaService(badConfig as unknown as ConfigService);
      expect(() => badService.buildAuthorizeUrl('ch', 'st')).toThrow(
        'CANVA_CLIENT_ID and CANVA_REDIRECT_URI must be set',
      );
    });
  });

  describe('exchangeAuthorizationCode — res.text() throws (catch callback)', () => {
    it('handles text() rejection in the error log gracefully', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error('text failed')),
      } as unknown as Response);

      const result = await service.exchangeAuthorizationCode({
        code: 'c', codeVerifier: 'v', redirectUri: 'http://r',
      });

      expect(result).toBeNull();
    });
  });

  describe('refreshAccessToken — res.text() throws (catch callback)', () => {
    it('handles text() rejection gracefully', async () => {
      // refreshAccessToken doesn't call res.text() on error, so just verify null return
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await service.refreshAccessToken('old-rt');
      expect(result).toBeNull();
    });
  });

  describe('getDesign — res.text() throws (catch callback)', () => {
    it('handles text() rejection in warning log', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.reject(new Error('text failed')),
      } as unknown as Response);

      const result = await service.getDesign('token', 'DA1');
      expect(result).toBeNull();
    });
  });

  describe('getDesignPages — res.text() throws (catch callback)', () => {
    it('handles text() rejection in warning log', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.reject(new Error('text failed')),
      } as unknown as Response);

      const result = await service.getDesignPages('token', 'DA1');
      expect(result).toEqual([]);
    });
  });

  describe('createPresentation — res.text() throws (catch callback)', () => {
    it('handles text() rejection in warning log', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error('text failed')),
      } as unknown as Response);

      const result = await service.createPresentation('token', 'Title');
      expect(result).toBeNull();
    });
  });

  describe('exchangeAuthorizationCode — additional branches', () => {
    it('returns null when response is missing required token fields', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'at' }),
      } as Response);

      const result = await service.exchangeAuthorizationCode({
        code: 'c', codeVerifier: 'v', redirectUri: 'http://r',
      });

      expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network'));

      const result = await service.exchangeAuthorizationCode({
        code: 'c', codeVerifier: 'v', redirectUri: 'http://r',
      });

      expect(result).toBeNull();
    });
  });

  describe('refreshAccessToken — additional branches', () => {
    it('returns null when response is missing token fields', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'at' }),
      } as Response);

      const result = await service.refreshAccessToken('old-rt');
      expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network'));

      const result = await service.refreshAccessToken('old-rt');
      expect(result).toBeNull();
    });
  });

  describe('getDesign', () => {
    it('returns editUrl from design response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          design: { urls: { edit_url: 'https://canva.com/edit/DA1' } },
        }),
      } as Response);

      const result = await service.getDesign('token', 'DA1');
      expect(result?.editUrl).toBe('https://canva.com/edit/DA1');
    });

    it('returns null editUrl when not present', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ design: {} }),
      } as Response);

      const result = await service.getDesign('token', 'DA1');
      expect(result?.editUrl).toBeNull();
    });

    it('returns null when API returns non-ok', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false, status: 404,
        text: () => Promise.resolve('not found'),
      } as Response);

      const result = await service.getDesign('token', 'DA1');
      expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network'));

      const result = await service.getDesign('token', 'DA1');
      expect(result).toBeNull();
    });
  });

  describe('getDesignPages', () => {
    it('returns mapped pages from API', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          items: [
            { index: 1, thumbnail: { url: 'https://img1.canva.com' } },
            { index: 2, thumbnail: { url: 'https://img2.canva.com' } },
          ],
        }),
      } as Response);

      const result = await service.getDesignPages('token', 'DA1');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ index: 1, thumbnailUrl: 'https://img1.canva.com' });
    });

    it('filters pages missing index or thumbnail url', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          items: [
            { index: 1, thumbnail: { url: 'https://img1.canva.com' } },
            { thumbnail: { url: 'https://img2.canva.com' } },
            { index: 3 },
          ],
        }),
      } as Response);

      const result = await service.getDesignPages('token', 'DA1');
      expect(result).toHaveLength(1);
    });

    it('returns empty array when items is missing', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const result = await service.getDesignPages('token', 'DA1');
      expect(result).toEqual([]);
    });

    it('returns empty array when API errors', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false, status: 403,
        text: () => Promise.resolve(''),
      } as Response);

      const result = await service.getDesignPages('token', 'DA1');
      expect(result).toEqual([]);
    });

    it('returns empty array when fetch throws', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network'));

      const result = await service.getDesignPages('token', 'DA1');
      expect(result).toEqual([]);
    });
  });

  describe('PKCE helpers', () => {
    it('generateCodeVerifier returns a non-empty string', () => {
      const v = service.generateCodeVerifier();
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(40);
    });

    it('generateOAuthState returns a non-empty string', () => {
      const s = service.generateOAuthState();
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(10);
    });

    it('codeChallengeFromVerifier produces a sha256 base64url string', () => {
      const challenge = service.codeChallengeFromVerifier('test-verifier');
      expect(typeof challenge).toBe('string');
      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
      expect(challenge).not.toContain('=');
    });
  });
});
