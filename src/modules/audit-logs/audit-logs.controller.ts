import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('groups/:groupId')
  findGroupLogs(
    @Param('groupId') _groupId: string,
    @Query('limit') _limit: number = 50,
  ) {
    // TODO: Get audit logs for group
    return [];
  }
}
