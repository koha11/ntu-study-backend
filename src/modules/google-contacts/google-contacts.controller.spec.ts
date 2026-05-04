import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { GoogleContactsController } from './google-contacts.controller';
import { GoogleContactsService } from './google-contacts.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

describe('GoogleContactsController', () => {
  let controller: GoogleContactsController;
  let service: { searchSuggestions: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = {
      searchSuggestions: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleContactsController],
      providers: [
        { provide: GoogleContactsService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(GoogleContactsController);
  });

  it('passes user id and q to searchSuggestions', async () => {
    service.searchSuggestions.mockResolvedValue([
      { email: 'a@b.com', display_name: 'A', photo_url: null },
    ]);

    const req = { user: { id: 'user-1' } } as never;
    const result = await controller.getSuggestions(req, 'foo');

    expect(service.searchSuggestions).toHaveBeenCalledWith('user-1', 'foo');
    expect(result).toEqual([
      { email: 'a@b.com', display_name: 'A', photo_url: null },
    ]);
  });

  it('uses empty string when q is undefined', async () => {
    service.searchSuggestions.mockResolvedValue([]);
    const req = { user: { id: 'u2' } } as never;
    await controller.getSuggestions(req, undefined);
    expect(service.searchSuggestions).toHaveBeenCalledWith('u2', '');
  });
});
