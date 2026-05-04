import { Injectable } from '@nestjs/common';

export interface CanvaOAuthSession {
  userId: string;
  codeVerifier: string;
  expiresAt: number;
}

/** In-memory PKCE session store for Canva OAuth (single-instance deployments). */
@Injectable()
export class CanvaOAuthSessionStore {
  private readonly sessions = new Map<string, CanvaOAuthSession>();

  setState(state: string, userId: string, codeVerifier: string): void {
    this.prune();
    this.sessions.set(state, {
      userId,
      codeVerifier,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
  }

  /**
   * Consumes the session (one-time use). Returns undefined if missing or expired.
   */
  take(state: string): { userId: string; codeVerifier: string } | undefined {
    this.prune();
    const row = this.sessions.get(state);
    if (!row || row.expiresAt < Date.now()) {
      this.sessions.delete(state);
      return undefined;
    }
    this.sessions.delete(state);
    return { userId: row.userId, codeVerifier: row.codeVerifier };
  }

  private prune(): void {
    const now = Date.now();
    for (const [k, v] of this.sessions) {
      if (v.expiresAt < now) {
        this.sessions.delete(k);
      }
    }
  }
}
