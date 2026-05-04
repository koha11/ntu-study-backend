import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import {
  GoogleContactsService,
  personToContact,
  contactMatchesQuery,
} from './google-contacts.service';
import { UsersService } from '@modules/users/users.service';
import { GoogleTokenExchangeService } from '@modules/auth/services/google-token-exchange.service';

const searchMock = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(function OAuth2() {
        return { setCredentials: vi.fn() };
      }),
    },
    people: vi.fn(() => ({
      otherContacts: {
        search: (...args: unknown[]) => searchMock(...args),
      },
    })),
  },
}));

describe('personToContact', () => {
  it('returns null when no email addresses', () => {
    expect(personToContact({})).toBeNull();
  });

  it('maps primary email and display name', () => {
    expect(
      personToContact({
        names: [{ displayName: 'Alice', metadata: { primary: true } }],
        emailAddresses: [
          { value: 'a@x.com', metadata: { primary: true } },
          { value: 'b@x.com' },
        ],
      }),
    ).toEqual({
      email: 'a@x.com',
      display_name: 'Alice',
      photo_url: null,
    });
  });

  it('falls back to first email and first name', () => {
    expect(
      personToContact({
        names: [{ displayName: 'Bob' }],
        emailAddresses: [{ value: 'bob@y.com' }],
      }),
    ).toEqual({
      email: 'bob@y.com',
      display_name: 'Bob',
      photo_url: null,
    });
  });

  it('maps primary photo url when present', () => {
    expect(
      personToContact({
        names: [{ displayName: 'Cam', metadata: { primary: true } }],
        emailAddresses: [{ value: 'c@x.com', metadata: { primary: true } }],
        photos: [
          { url: 'https://example.com/p.jpg', metadata: { primary: true } },
        ],
      }),
    ).toEqual({
      email: 'c@x.com',
      display_name: 'Cam',
      photo_url: 'https://example.com/p.jpg',
    });
  });
});

describe('contactMatchesQuery', () => {
  it('returns false for blank query', () => {
    expect(
      contactMatchesQuery(
        { email: 'a@b.com', display_name: 'X' },
        '   ',
      ),
    ).toBe(false);
  });

  it('matches email substring case-insensitively', () => {
    expect(
      contactMatchesQuery({ email: 'User@NTU.edu.vn', display_name: null }, 'ntu'),
    ).toBe(true);
  });

  it('matches display name substring', () => {
    expect(
      contactMatchesQuery(
        { email: 'x@y.com', display_name: 'Nguyen Van A' },
        'van',
      ),
    ).toBe(true);
  });
});

describe('GoogleContactsService', () => {
  let service: GoogleContactsService;
  let usersService: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let googleTokenExchange: { refreshAccessToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    searchMock.mockReset();
    usersService = {
      findById: vi.fn(),
      update: vi.fn(),
    };
    googleTokenExchange = {
      refreshAccessToken: vi.fn(),
    };
    service = new GoogleContactsService(
      usersService as unknown as UsersService,
      googleTokenExchange as unknown as GoogleTokenExchangeService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns [] when query is empty', async () => {
    await expect(service.searchSuggestions('u1', '  ')).resolves.toEqual([]);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('throws when user not found', async () => {
    usersService.findById.mockResolvedValue(null);
    await expect(service.searchSuggestions('u1', 'a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws when no Google access token can be resolved', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: null,
      google_refresh_token: null,
    });
    await expect(service.searchSuggestions('u1', 'a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns filtered suggestions from otherContacts.search', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
      google_refresh_token: 'rt',
      token_expires_at: new Date(Date.now() + 3600_000),
    });

    searchMock.mockResolvedValueOnce({
      data: {
        results: [
          {
            person: {
              names: [{ displayName: 'Ann', metadata: { primary: true } }],
              emailAddresses: [
                { value: 'ann@school.edu', metadata: { primary: true } },
              ],
            },
          },
          {
            person: {
              names: [{ displayName: 'Bob' }],
              emailAddresses: [{ value: 'bob@other.org' }],
            },
          },
        ],
      },
    });

    const result = await service.searchSuggestions('u1', 'school');
    expect(result).toEqual([
      {
        email: 'ann@school.edu',
        display_name: 'Ann',
        photo_url: null,
      },
    ]);
    expect(searchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'school',
        readMask: 'names,emailAddresses',
        pageSize: 15,
      }),
    );
  });
});
