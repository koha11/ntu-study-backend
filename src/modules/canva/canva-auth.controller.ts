import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';
import { UsersService } from '@modules/users/users.service';
import { CanvaOAuthSessionStore } from './canva-oauth-session.store';
import { CanvaService } from './canva.service';

@ApiTags('Auth / Canva')
@Controller('auth/canva')
export class CanvaAuthController {
  constructor(
    private readonly canvaService: CanvaService,
    private readonly sessionStore: CanvaOAuthSessionStore,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Post('start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Start Canva OAuth (returns authorize URL for browser redirect)',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization URL to open in the browser',
    schema: {
      example: {
        authorizeUrl:
          'https://www.canva.com/api/oauth/authorize?code_challenge=...',
      },
    },
  })
  start(@Req() req: Request): { authorizeUrl: string } {
    const user = req.user as JwtRequestUser;
    const codeVerifier = this.canvaService.generateCodeVerifier();
    const codeChallenge =
      this.canvaService.codeChallengeFromVerifier(codeVerifier);
    const state = this.canvaService.generateOAuthState();
    this.sessionStore.setState(state, user.id, codeVerifier);
    const authorizeUrl = this.canvaService.buildAuthorizeUrl(
      codeChallenge,
      state,
    );
    return { authorizeUrl };
  }

  @Get('callback')
  @ApiOperation({ summary: 'Canva OAuth redirect target (configured in Canva portal)' })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontend =
      this.config.get<string>('FRONTEND_URL')?.trim() ||
      'http://localhost:5173';

    if (error) {
      res.redirect(
        `${frontend}/canva-connected?error=${encodeURIComponent(error)}`,
      );
      return;
    }

    if (!code?.trim() || !state?.trim()) {
      res.redirect(`${frontend}/canva-connected?error=missing_params`);
      return;
    }

    const session = this.sessionStore.take(state.trim());
    if (!session) {
      res.redirect(`${frontend}/canva-connected?error=invalid_state`);
      return;
    }

    const redirectUri =
      this.config.get<string>('CANVA_REDIRECT_URI')?.trim() ?? '';

    const tokens = await this.canvaService.exchangeAuthorizationCode({
      code: code.trim(),
      codeVerifier: session.codeVerifier,
      redirectUri,
    });

    if (!tokens) {
      res.redirect(
        `${frontend}/canva-connected?error=token_exchange_failed`,
      );
      return;
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await this.usersService.update(session.userId, {
      canva_access_token: tokens.access_token,
      canva_refresh_token: tokens.refresh_token,
      canva_token_expires_at: expiresAt,
    });

    res.redirect(`${frontend}/canva-connected?success=1`);
  }
}
