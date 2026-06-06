import { Injectable, Logger } from '@nestjs/common';
import { User } from '@modules/users/entities/user.entity';
import { UsersService } from '@modules/users/users.service';
import { GoogleTokenExchangeService } from './google-token-exchange.service';

/** Refresh access token this many ms before Google reports expiry. */
export const GOOGLE_TOKEN_EXPIRY_BUFFER_MS = 120_000;

@Injectable()
export class GoogleAccessTokenService {
  private readonly logger = new Logger(GoogleAccessTokenService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly googleTokenExchange: GoogleTokenExchangeService,
  ) {}

  /**
   * Returns a usable Google OAuth access token for the user, refreshing via
   * refresh_token when the access token is missing or near expiry.
   */
  async resolveGoogleAccessToken(user: User): Promise<string | null> {
    this.logger.debug(`Resolving Google access token for user ${user.id}`);
    const now = Date.now();
    const expiryMs = user.token_expires_at?.getTime() ?? 0;
    const accessLooksFresh =
      !!user.google_access_token &&
      (!user.token_expires_at ||
        expiryMs > now + GOOGLE_TOKEN_EXPIRY_BUFFER_MS);

    if (accessLooksFresh) {
      this.logger.debug(`Access token is fresh for user ${user.id}`);
      return user.google_access_token!;
    }

    if (!user.google_refresh_token) {
      return user.google_access_token ?? null;
    }

    try {
      const refreshed = await this.googleTokenExchange.refreshAccessToken(
        user.google_refresh_token,
      );
      await this.usersService.update(user.id, {
        google_access_token: refreshed.access_token,
        token_expires_at: refreshed.expiry_date,
      });
      this.logger.log(`Refreshed Google access token for user ${user.id}`);
      return refreshed.access_token;
    } catch {
      this.logger.error(`Failed to refresh Google access token for user ${user.id}`);
      return null;
    }
  }
}
