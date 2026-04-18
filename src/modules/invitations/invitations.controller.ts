import { Controller, Post, Get, Param } from '@nestjs/common';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post(':token/accept')
  acceptInvitation(@Param('token') _token: string) {
    // TODO: Accept invitation
    return {};
  }

  @Get(':token/validate')
  validateToken(@Param('token') _token: string) {
    // TODO: Validate token
    return { valid: true };
  }

  @Get('groups/:groupId')
  findGroupInvitations(@Param('groupId') _groupId: string) {
    // TODO: Get group invitations
    return [];
  }
}
