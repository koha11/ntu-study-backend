import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';
import {
  GoogleContactsService,
  type ContactSuggestion,
} from './google-contacts.service';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class GoogleContactsController {
  constructor(private readonly googleContactsService: GoogleContactsService) {}

  @Get('suggestions')
  async getSuggestions(
    @Req() req: Request & { user: JwtRequestUser },
    @Query('q') q?: string,
  ): Promise<ContactSuggestion[]> {
    return this.googleContactsService.searchSuggestions(req.user.id, q ?? '');
  }
}
