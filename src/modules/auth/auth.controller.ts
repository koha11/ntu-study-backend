import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiExcludeEndpoint,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleCallbackResponseDto } from './dto';
import { AuthService } from './auth.service';

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
  googleAuthCallbackRedirect(@Req() req: any): GoogleCallbackResponseDto {
    // Passport GoogleStrategy.validate() returns { id, email }
    // Return user_id for consistency with POST callback flow
    if (!req.user?.id) {
      throw new Error('User ID not found in authenticated request');
    }
    return { user_id: req.user.id };
  }

  @Post('google/callback')
  @ApiOperation({
    summary: 'Exchange Google authorization code for user ID',
    description:
      'Frontend-driven OAuth flow: receives authorization code and PKCE code_verifier, ' +
      'exchanges code with Google servers, verifies identity, and returns user ID. ' +
      'Creates new user if first login, returns existing user_id if returning user.',
  })
  @ApiQuery({
    name: 'code',
    type: 'string',
    required: true,
    description: 'Authorization code from Google OAuth flow',
  })
  @ApiQuery({
    name: 'code_verifier',
    type: 'string',
    required: true,
    description: 'PKCE code verifier used in authorization request',
  })
  @ApiResponse({
    status: 200,
    description:
      'User successfully authenticated or created; returns JWT access and refresh tokens',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid code/code_verifier parameters',
  })
  @ApiResponse({
    status: 401,
    description:
      'Invalid authorization code or Google token verification failed',
  })
  @ApiResponse({
    status: 500,
    description: 'Server error during code exchange or user creation',
  })
  async googleCallbackPostFlow(@Query() query: any): Promise<LoginResponseDto> {
    const { code, code_verifier } = query;

    // Validate required parameters
    if (!code || !code_verifier) {
      throw new BadRequestException(
        'Missing required parameters: code and code_verifier are required',
      );
    }

    if (typeof code !== 'string' || typeof code_verifier !== 'string') {
      throw new BadRequestException(
        'Invalid parameter types: code and code_verifier must be strings',
      );
    }

    const userId = await this.authService.googleAuth({ code, code_verifier });
    return this.authService.loginByUserId(userId);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({
    status: 200,
    description: 'New JWT token issued',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid refresh_token body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async refreshToken(@Body() body: RefreshTokenDto): Promise<LoginResponseDto> {
    const { refresh_token } = body;
    return await this.authService.refreshToken(refresh_token);
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Verify current JWT token' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    schema: {
      example: { valid: true, sub: 'user-id', email: 'user@example.com' },
    },
  })
  @ApiResponse({ status: 401, description: 'Token is invalid or expired' })
  verify(@Req() req: { user: { id: string; email?: string } }) {
    return {
      valid: true,
      sub: req.user.id,
      ...(req.user.email != null ? { email: req.user.email } : {}),
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Logout user',
    description:
      'Invalidates all refresh tokens for this user (increment session version).',
  })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Req() req: any) {
    await this.authService.logout(req.user);
    return { message: 'Logged out' };
  }
}
