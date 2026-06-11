import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CanvaOAuthSessionStore } from './canva-oauth-session.store';

describe('CanvaOAuthSessionStore', () => {
  let store: CanvaOAuthSessionStore;

  beforeEach(() => {
    store = new CanvaOAuthSessionStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setState / take', () => {
    it('stores a session and allows it to be consumed once', () => {
      store.setState('state-1', 'user-1', 'verifier-abc');

      const result = store.take('state-1');
      expect(result).toEqual({
        userId: 'user-1',
        codeVerifier: 'verifier-abc',
      });
    });

    it('returns undefined for an unknown state key', () => {
      const result = store.take('nonexistent');
      expect(result).toBeUndefined();
    });

    it('is one-time-use: returns undefined on second take', () => {
      store.setState('state-2', 'user-2', 'verifier-xyz');

      store.take('state-2');
      const second = store.take('state-2');

      expect(second).toBeUndefined();
    });

    it('returns undefined for an expired session', () => {
      store.setState('state-3', 'user-3', 'verifier-exp');

      // Advance time past the 10-minute expiration
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);

      const result = store.take('state-3');
      expect(result).toBeUndefined();
    });

    it('succeeds for a session accessed just before expiry', () => {
      store.setState('state-4', 'user-4', 'verifier-ok');

      // Advance just under 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000 - 1);

      const result = store.take('state-4');
      expect(result).toEqual({ userId: 'user-4', codeVerifier: 'verifier-ok' });
    });

    it('stores multiple independent sessions', () => {
      store.setState('s1', 'u1', 'v1');
      store.setState('s2', 'u2', 'v2');

      expect(store.take('s1')).toEqual({ userId: 'u1', codeVerifier: 'v1' });
      expect(store.take('s2')).toEqual({ userId: 'u2', codeVerifier: 'v2' });
    });
  });

  describe('prune (via setState)', () => {
    it('removes expired sessions when a new session is set', () => {
      store.setState('old-state', 'user-old', 'verifier-old');

      // Expire old session
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);

      // Setting a new session triggers prune
      store.setState('new-state', 'user-new', 'verifier-new');

      // Old expired session should be gone
      expect(store.take('old-state')).toBeUndefined();
      // New session should still work
      expect(store.take('new-state')).toEqual({
        userId: 'user-new',
        codeVerifier: 'verifier-new',
      });
    });
  });
});
