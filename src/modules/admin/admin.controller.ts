import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth('JWT')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved',
    schema: {
      example: {
        users: [
          {
            id: 'user-id-uuid',
            email: 'user@example.ntu.edu.sg',
            full_name: 'John Doe',
            role: 'user',
            locked: false,
          },
        ],
        total: 100,
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAllUsers(
    @Query('skip') _skip: number = 0,
    @Query('take') _take: number = 20,
  ) {
    // TODO: Get all users
    return { users: [], total: 0 };
  }

  @Post('users/:id/lock')
  @ApiOperation({ summary: 'Lock user account (admin only)' })
  @ApiResponse({ status: 200, description: 'User locked' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  lockUser(@Param('id') _id: string) {
    // TODO: Lock user
    return {};
  }

  @Post('users/:id/unlock')
  @ApiOperation({ summary: 'Unlock user account (admin only)' })
  @ApiResponse({ status: 200, description: 'User unlocked' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  unlockUser(@Param('id') _id: string) {
    // TODO: Unlock user
    return {};
  }

  @Get('groups')
  @ApiOperation({ summary: 'List all groups (admin only)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Groups retrieved',
    schema: {
      example: {
        groups: [
          {
            id: 'group-id-uuid',
            name: 'CS2040S Study Group',
            member_count: 5,
          },
        ],
        total: 50,
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAllGroups(
    @Query('skip') _skip: number = 0,
    @Query('take') _take: number = 20,
  ) {
    // TODO: Get all groups
    return { groups: [], total: 0 };
  }

  @Post('groups/:id/delete')
  @ApiOperation({ summary: 'Delete group (admin only)' })
  @ApiResponse({ status: 200, description: 'Group deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  deleteGroup(@Param('id') _id: string) {
    // TODO: Delete group
    return {};
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved',
    schema: {
      example: {
        total_users: 250,
        total_groups: 45,
        total_tasks: 1200,
        active_sessions: 18,
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getDashboard() {
    // TODO: Get dashboard stats
    return {};
  }
}
