import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { InvitationsService } from './invitations.service';
import { AcceptInvitationDto } from './dto';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('pending-token/:invitationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary:
      'Get invitation token for current user (matches invitation email; pending only)',
  })
  @ApiResponse({ status: 200, description: 'Token returned' })
  @ApiResponse({ status: 400, description: 'Expired or not pending' })
  @ApiResponse({ status: 404, description: 'Not found or not for this user' })
  getPendingInvitationToken(
    @Req() req: Request,
    @Param('invitationId') invitationId: string,
  ) {
    const user = req.user as JwtRequestUser;
    return this.invitationsService.getPendingInvitationTokenForRecipient(
      invitationId,
      user.id,
    );
  }

  @Get('groups/:groupId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'List invitations for a group (leader only)',
  })
  @ApiResponse({ status: 200, description: 'Invitations retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  findGroupInvitations(@Req() req: Request, @Param('groupId') groupId: string) {
    const user = req.user as JwtRequestUser;
    return this.invitationsService.findGroupInvitationsForLeader(
      groupId,
      user.id,
    );
  }

  @Post('groups/:groupId/invitations/:invitationId/resend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Resend group invitation (leader only)' })
  @ApiResponse({ status: 201, description: 'New invitation created and email sent' })
  @ApiResponse({ status: 400, description: 'Invalid invitation' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Already accepted' })
  resendGroupInvitation(
    @Req() req: Request,
    @Param('groupId') groupId: string,
    @Param('invitationId') invitationId: string,
  ) {
    const user = req.user as JwtRequestUser;
    return this.invitationsService.resendGroupInvitation({
      groupId,
      invitationId,
      leaderUserId: user.id,
    });
  }

  /**
   * Browsers follow invite links with GET. The SPA lives on FRONTEND_URL, not the API.
   * If a user opens the link on the API host (e.g. :3000), redirect to the app.
   * Accepting the group is still POST :token/accept (or the SPA calls validate/accept via JSON).
   */
  @Get(':token/accept')
  @ApiOperation({
    summary: 'Redirect GET to SPA invitation page',
    description:
      'Returns 302 to FRONTEND_URL/invitations/:token/accept so email links work when opened on the API host.',
  })
  @ApiResponse({
    status: 400,
    description:
      'FRONTEND_URL misconfigured (same as API — would redirect in a loop)',
  })
  @ApiResponse({ status: 302, description: 'Redirect to frontend accept page' })
  redirectAcceptPage(
    @Req() req: Request,
    @Param('token') token: string,
    @Res() res: Response,
  ): void {
    const base =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ??
      'http://localhost:5173';
    const target = `${base}/invitations/${encodeURIComponent(token)}/accept`;

    let outgoing: URL;
    try {
      outgoing = new URL(target);
    } catch {
      res.status(500).json({
        message: 'Invalid FRONTEND_URL — must be a full URL (e.g. http://localhost:5173)',
      });
      return;
    }

    const xfProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const proto = (xfProto || req.protocol || 'http').replace(/:$/, '');
    const host = req.get('host');
    if (!host) {
      res.status(400).json({ message: 'Missing Host header' });
      return;
    }

    let incoming: URL;
    try {
      incoming = new URL(`${proto}://${host}${req.originalUrl}`);
    } catch {
      res.status(400).json({ message: 'Could not parse request URL' });
      return;
    }

    // If FRONTEND_URL points at this same host + path (e.g. both :3000), redirect loops forever.
    const sameDestination =
      incoming.origin === outgoing.origin &&
      incoming.pathname === outgoing.pathname &&
      incoming.search === outgoing.search;

    if (sameDestination) {
      res.status(400).json({
        message:
          'FRONTEND_URL must be your SPA origin, not the API. Example: FRONTEND_URL=http://localhost:5173 while the API runs on :3000. Update backend .env and restart.',
        apiHost: host,
        misconfiguredTarget: target,
      });
      return;
    }

    res.redirect(302, target);
  }

  @Post(':token/accept')
  @ApiOperation({ summary: 'Accept invitation by token (public)' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  @ApiResponse({ status: 400, description: 'Invalid or expired invitation' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  acceptInvitation(
    @Param('token') token: string,
    @Body() body: AcceptInvitationDto,
  ) {
    return this.invitationsService.acceptInvitation(token, body ?? {});
  }

  @Get(':token/validate')
  @ApiOperation({ summary: 'Validate invitation token (public)' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validateToken(@Param('token') token: string) {
    return this.invitationsService.validateInvitationToken(token);
  }
}
