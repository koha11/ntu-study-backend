import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@Controller('notifications')
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
  getUserNotifications(@Query('unread') _unread?: boolean) {
    // TODO: Get user notifications
    return [];
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(@Param('id') _id: string) {
    // TODO: Mark as read
    return {};
  }
}
