import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { AdminGuard } from '@modules/auth/guards/admin.guard';
import { TaskSchedulerService } from '@common/services/task-scheduler.service';

@ApiTags('Admin')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly taskSchedulerService: TaskSchedulerService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAllUsers(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take: number,
    @Query('q') q?: string,
  ) {
    return this.adminService.findAllUsers(skip, take, q);
  }

  @Post('users/:id/lock')
  @ApiOperation({ summary: 'Lock user account (admin only)' })
  @ApiResponse({ status: 200, description: 'User locked' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  lockUser(@Param('id') id: string) {
    return this.adminService.lockUser(id);
  }

  @Post('users/:id/unlock')
  @ApiOperation({ summary: 'Unlock user account (admin only)' })
  @ApiResponse({ status: 200, description: 'User unlocked' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  unlockUser(@Param('id') id: string) {
    return this.adminService.unlockUser(id);
  }

  @Get('groups')
  @ApiOperation({ summary: 'List all groups (admin only)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Groups retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAllGroups(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take: number,
  ) {
    return this.adminService.findAllGroups(skip, take);
  }

  @Delete('groups/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete group (admin only)' })
  @ApiResponse({ status: 204, description: 'Group deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async deleteGroup(@Param('id') id: string): Promise<void> {
    await this.adminService.deleteGroup(id);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Dashboard statistics and cron history (admin only)',
    description:
      'Includes totals, last-7-day cron aggregates, and recent cron_job_runs (v1 system log for scheduling).',
  })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Post('cron-jobs/:name/run')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Manually run a cron job by slug (admin only)',
    description:
      'Known names: overdue-task-reminders, notification-cleanup (see CRON_JOB_NAMES).',
  })
  @ApiResponse({ status: 204, description: 'Job finished (check cron_job_runs for status)' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Unknown job name' })
  async runCronJob(@Param('name') name: string): Promise<void> {
    await this.taskSchedulerService.runJobBySlug(name);
  }
}
