import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardNotificationDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() message!: string;
  @ApiProperty() isRead!: boolean;
  @ApiPropertyOptional() relatedEntityType?: string;
  @ApiPropertyOptional() relatedEntityId?: string;
}

export class DashboardDriveActivityDto {
  @ApiProperty() fileName!: string;
  @ApiPropertyOptional() fileId?: string;
  @ApiProperty() action!: string;
  @ApiProperty() actorLabel!: string;
  @ApiPropertyOptional() actorDisplayName?: string;
  @ApiPropertyOptional() actorPhotoUrl?: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() groupName!: string;
}

export class RecentActivityItemDto {
  @ApiProperty({ enum: ['notification', 'drive_activity'] })
  kind!: 'notification' | 'drive_activity';

  @ApiProperty({ description: 'ISO 8601 timestamp' })
  occurredAt!: string;

  @ApiPropertyOptional({ type: DashboardNotificationDto })
  notification?: DashboardNotificationDto;

  @ApiPropertyOptional({ type: DashboardDriveActivityDto })
  driveActivity?: DashboardDriveActivityDto;
}

export class UpcomingTaskDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() status!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() groupName!: string;
}

export class CalendarEventStartEndDto {
  @ApiPropertyOptional() dateTime?: string;
  @ApiPropertyOptional() date?: string;
}

export class UpcomingCalendarEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() summary!: string;
  @ApiProperty({ type: CalendarEventStartEndDto }) start!: CalendarEventStartEndDto;
  @ApiProperty({ type: CalendarEventStartEndDto }) end!: CalendarEventStartEndDto;
  @ApiProperty() htmlLink!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() groupName!: string;
}

export class UpcomingItemDto {
  @ApiProperty({ enum: ['task', 'calendar_event'] })
  kind!: 'task' | 'calendar_event';

  @ApiProperty({ description: 'ISO 8601 date of the task due date or event start' })
  date!: string;

  @ApiPropertyOptional({ type: UpcomingTaskDto }) task?: UpcomingTaskDto;
  @ApiPropertyOptional({ type: UpcomingCalendarEventDto }) calendarEvent?: UpcomingCalendarEventDto;
}

export class DashboardResponseDto {
  @ApiProperty({ type: [RecentActivityItemDto], description: 'Up to 10 items, newest first' })
  recentActivity!: RecentActivityItemDto[];

  @ApiProperty({ type: [UpcomingItemDto], description: 'Sorted by date ascending' })
  upcoming!: UpcomingItemDto[];
}
