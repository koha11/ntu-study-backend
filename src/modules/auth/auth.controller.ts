import { Controller, Get, Post, UseGuards, Req, Res } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiExcludeEndpoint()
  googleAuth() {
    // TODO: Implement Google OAuth redirect
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiExcludeEndpoint()
  async googleAuthCallback(@Req() _req: any, @Res() res: any) {
    // TODO: Implement Google OAuth callback
    return res.json({ message: 'callback' });
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({
    status: 200,
    description: 'New JWT token issued',
    schema: {
      example: { access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  refreshToken() {
    // TODO: Implement token refresh
    return { access_token: 'token' };
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify current JWT token' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    schema: { example: { valid: true, sub: 'user-id' } },
  })
  @ApiResponse({ status: 401, description: 'Token is invalid or expired' })
  verify() {
    // TODO: Implement token verification
    return { valid: true };
  }
}
