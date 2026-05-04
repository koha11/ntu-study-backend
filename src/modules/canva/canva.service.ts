import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const CANVA_AUTH_BASE = 'https://www.canva.com/api/oauth/authorize';
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
const CANVA_API_BASE = 'https://api.canva.com/rest/v1';

/** Scopes configured in Canva Developer Portal must include these. */
const CANVA_SCOPES = 'design:content:write design:meta:read';

export interface CanvaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface CreatedCanvaPresentation {
  designId: string;
  viewUrl: string;
  editUrl?: string;
}

@Injectable()
export class CanvaService {
  private readonly logger = new Logger(CanvaService.name);

  constructor(private readonly config: ConfigService) {}

  /** PKCE code verifier (43–128 chars, URL-safe). */
  generateCodeVerifier(): string {
    return crypto.randomBytes(96).toString('base64url');
  }

  generateOAuthState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  codeChallengeFromVerifier(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  /**
   * Full authorize URL for redirecting the user browser to Canva.
   */
  buildAuthorizeUrl(codeChallenge: string, state: string): string {
    const clientId = this.config.get<string>('CANVA_CLIENT_ID');
    const redirectUri = this.config.get<string>('CANVA_REDIRECT_URI');
    if (!clientId?.trim() || !redirectUri?.trim()) {
      throw new Error('CANVA_CLIENT_ID and CANVA_REDIRECT_URI must be set');
    }
    const params = new URLSearchParams({
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: CANVA_SCOPES,
      response_type: 'code',
      client_id: clientId.trim(),
      state,
      redirect_uri: redirectUri.trim(),
    });
    return `${CANVA_AUTH_BASE}?${params.toString()}`;
  }

  private basicAuthHeader(): string {
    const id = this.config.get<string>('CANVA_CLIENT_ID')?.trim() ?? '';
    const secret = this.config.get<string>('CANVA_CLIENT_SECRET')?.trim() ?? '';
    const b64 = Buffer.from(`${id}:${secret}`, 'utf8').toString('base64');
    return `Basic ${b64}`;
  }

  async exchangeAuthorizationCode(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<CanvaTokenResponse | null> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code_verifier: params.codeVerifier,
      code: params.code,
      redirect_uri: params.redirectUri.trim(),
    });

    try {
      const res = await fetch(CANVA_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: this.basicAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`Canva token exchange failed: ${res.status} ${text}`);
        return null;
      }

      const data = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };
      if (
        !data.access_token ||
        !data.refresh_token ||
        data.expires_in === undefined
      ) {
        return null;
      }
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    } catch (e) {
      this.logger.error(
        `Canva token exchange error: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<CanvaTokenResponse | null> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    try {
      const res = await fetch(CANVA_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: this.basicAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };
      if (
        !data.access_token ||
        !data.refresh_token ||
        data.expires_in === undefined
      ) {
        return null;
      }
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    } catch (e) {
      this.logger.error(
        `Canva refresh error: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  async createPresentation(
    accessToken: string,
    title: string,
  ): Promise<CreatedCanvaPresentation | null> {
    try {
      const res = await fetch(`${CANVA_API_BASE}/designs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          design_type: {
            type: 'preset',
            name: 'presentation',
          },
          title: title.trim(),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`Canva create design failed: ${res.status} ${text}`);
        return null;
      }

      const data = (await res.json()) as {
        design?: {
          id?: string;
          urls?: { view_url?: string; edit_url?: string };
        };
      };
      const design = data.design;
      const designId = design?.id;
      const viewUrl = design?.urls?.view_url;
      const editUrl = design?.urls?.edit_url;
      if (!designId || !viewUrl) {
        this.logger.warn('Canva create design: missing id or view_url');
        return null;
      }
      return {
        designId,
        viewUrl,
        ...(editUrl !== undefined ? { editUrl } : {}),
      };
    } catch (e) {
      this.logger.error(
        `Canva create design error: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }
}
