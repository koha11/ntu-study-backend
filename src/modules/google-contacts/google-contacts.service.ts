import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { google, type people_v1 } from 'googleapis';
import { GoogleTokenExchangeService } from '@modules/auth/services/google-token-exchange.service';
import { UsersService } from '@modules/users/users.service';
import { User } from '@modules/users/entities/user.entity';

const TOKEN_EXPIRY_BUFFER_MS = 120_000;
/** otherContacts.search caps pageSize at 30 */
const MAX_SEARCH_PAGE_SIZE = 30;
const MAX_SUGGESTIONS = 15;

export interface ContactSuggestion {
  email: string;
  display_name: string | null;
  /** Profile image URL when returned by People API */
  photo_url: string | null;
}

/** @internal exported for unit tests */
export function personToContact(
  person: people_v1.Schema$Person,
): ContactSuggestion | null {
  const emails = person.emailAddresses;
  if (!emails?.length) {
    return null;
  }
  const primary = emails.find((e) => e.metadata?.primary) ?? emails[0];
  const value = primary?.value?.trim();
  if (!value) {
    return null;
  }
  const displayName = person.names?.find(
    (n) => n.metadata?.primary,
  )?.displayName;
  const name =
    displayName?.trim() || person.names?.[0]?.displayName?.trim() || null;
  const photos = person.photos;
  let photoUrl: string | null = null;
  if (photos?.length) {
    const best =
      photos.find((p) => p.metadata?.primary) ?? photos[0];
    photoUrl = best?.url?.trim() || null;
  }
  return { email: value, display_name: name, photo_url: photoUrl };
}

/** @internal exported for unit tests */
export function contactMatchesQuery(c: ContactSuggestion, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    return false;
  }
  if (c.email.toLowerCase().includes(needle)) {
    return true;
  }
  if (c.display_name && c.display_name.toLowerCase().includes(needle)) {
    return true;
  }
  return false;
}

@Injectable()
export class GoogleContactsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly googleTokenExchange: GoogleTokenExchangeService,
  ) {}

  async searchSuggestions(
    userId: string,
    query: string,
  ): Promise<ContactSuggestion[]> {
    const q = query.trim();
    if (!q) {
      return [];
    }

    const user = await this.usersService.findById(userId, true);
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const accessToken = await this.resolveGoogleAccessToken(user);
    if (!accessToken) {
      throw new ForbiddenException(
        'Google sign-in with contacts access required. Sign out and sign in again.',
      );
    }

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const peopleClient = google.people({ version: 'v1', auth: oauth2 });

    let results: people_v1.Schema$SearchResult[] = [];

    try {
      /** REST: GET …/v1/otherContacts:search — Google uses prefix-oriented matching; we still substring-filter returned rows. */
      const res = await peopleClient.otherContacts.search({
        query: q,
        readMask: 'names,emailAddresses',
        pageSize: Math.min(MAX_SUGGESTIONS, MAX_SEARCH_PAGE_SIZE),
      });
      results = res.data.results ?? [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        typeof msg === 'string' &&
        (msg.includes('403') ||
          msg.toLowerCase().includes('insufficient') ||
          msg.toLowerCase().includes('permission'))
      ) {
        throw new ForbiddenException(
          'Cannot read Google contacts. Sign out and sign in again to grant contacts access.',
        );
      }
      throw new InternalServerErrorException(
        `Google Contacts request failed: ${msg}`,
      );
    }

    const seen = new Set<string>();
    const all: ContactSuggestion[] = [];
    for (const hit of results) {
      const row = hit.person ? personToContact(hit.person) : null;
      if (!row) {
        continue;
      }
      if (!contactMatchesQuery(row, q)) {
        continue;
      }
      const key = row.email.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      all.push(row);
    }

    return all.slice(0, MAX_SUGGESTIONS);
  }

  private async resolveGoogleAccessToken(user: User): Promise<string | null> {
    const now = Date.now();
    const expiryMs = user.token_expires_at?.getTime() ?? 0;
    const accessLooksFresh =
      !!user.google_access_token &&
      (!user.token_expires_at || expiryMs > now + TOKEN_EXPIRY_BUFFER_MS);

    if (accessLooksFresh) {
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
      return refreshed.access_token;
    } catch {
      return null;
    }
  }
}
