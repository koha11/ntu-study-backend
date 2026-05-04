import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';
import type { Request } from 'express';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Get user's notifications" })
  @ApiQuery({
    name: 'unread',
    required: false,
    type: Boolean,
    description: 'Filter to unread notifications only',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved',
    schema: {
      example: [
        {
          id: 'notification-id-uuid',
          type: 'task_reminder',
          message: 'Task "Submit assignment" is due tomorrow',
          is_read: false,
          created_at: '2026-04-18T12:00:00Z',
        },
      ],
    },
  })
  getUserNotifications(
    @Req() req: Request & { user: JwtRequestUser },
    @Query('unread') unread?: string,
  ) {
    const user = req.user;
    const unreadOnly =
      unread === 'true' || unread === '1' ? true : undefined;
    return this.notificationsService.getUserNotifications(
      user.id,
      unreadOnly,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(
    @Req() req: Request & { user: JwtRequestUser },
    @Param('id') id: string,
  ) {
    const user = req.user;
    return this.notificationsService.markAsRead(id, user.id);
  }
}
