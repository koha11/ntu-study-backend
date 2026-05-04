import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GoogleAccessTokenService } from '@modules/auth/services/google-access-token.service';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { User } from './entities/user.entity';

function canvaConnected(user: User): boolean {
  return Boolean(user.canva_access_token || user.canva_refresh_token);
}

function toProfileResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    avatar_url: user.avatar_url ?? null,
    role: user.role,
    notification_enabled: user.notification_enabled,
    canva_connected: canvaConnected(user),
    drive_total_quota:
      user.drive_total_quota != null ? String(user.drive_total_quota) : null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly googleAccessTokenService: GoogleAccessTokenService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved',
    schema: {
      example: {
        id: 'user-id-uuid',
        email: 'user@example.ntu.edu.sg',
        full_name: 'John Doe',
        role: 'user',
        notification_enabled: true,
        canva_connected: false,
        created_at: '2026-04-18T00:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@Req() req: { user: { id: string } }) {
    const user = await this.usersService.findOne(req.user.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toProfileResponse(user);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @Req() req: { user: { id: string } },
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const patch: Partial<User> = {};
    if (updateUserDto.full_name !== undefined) {
      patch.full_name = updateUserDto.full_name;
    }
    if (updateUserDto.avatar_url !== undefined) {
      patch.avatar_url = updateUserDto.avatar_url;
    }
    if (updateUserDto.notification_enabled !== undefined) {
      patch.notification_enabled = updateUserDto.notification_enabled;
    }
    if (updateUserDto.drive_total_quota !== undefined) {
      patch.drive_total_quota =
        updateUserDto.drive_total_quota === null
          ? (null as unknown as number)
          : (updateUserDto.drive_total_quota as unknown as number);
    }

    if (Object.keys(patch).length > 0) {
      await this.usersService.update(req.user.id, patch);
    }

    const user = await this.usersService.findOne(req.user.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toProfileResponse(user);
  }

  @Post('me/google-profile/sync')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Set name and photo from your Google account' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated from Google userinfo',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot reach Google or no Google tokens',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async syncGoogleProfile(@Req() req: { user: { id: string } }) {
    const user = await this.usersService.findById(req.user.id, true);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const accessToken =
      await this.googleAccessTokenService.resolveGoogleAccessToken(user);
    if (!accessToken) {
      throw new BadRequestException(
        'No usable Google session. Sign out and sign in with Google again.',
      );
    }

    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new BadRequestException(
        'Could not load your Google profile. Try signing in again.',
      );
    }

    const data = (await res.json()) as { name?: string; picture?: string };
    const full_name =
      typeof data.name === 'string' && data.name.trim().length > 0
        ? data.name.trim()
        : user.full_name;

    const patch: Partial<User> = { full_name };
    if (typeof data.picture === 'string' && data.picture.length > 0) {
      patch.avatar_url = data.picture;
    }

    await this.usersService.update(user.id, patch);

    const updated = await this.usersService.findOne(user.id);
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return toProfileResponse(updated);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    schema: {
      example: {
        id: 'user-id-uuid',
        email: 'user@example.ntu.edu.sg',
        full_name: 'John Doe',
        role: 'user',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUser(@Param('id') _id: string) {
    // TODO: Get user by id
    return {};
  }
}
