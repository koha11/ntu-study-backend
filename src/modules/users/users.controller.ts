import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/user.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
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
        created_at: '2026-04-18T00:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile() {
    // TODO: Get current user profile
    return {};
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateProfile(@Body() _updateUserDto: UpdateUserDto) {
    // TODO: Update current user profile
    return {};
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
