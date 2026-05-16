import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Get aggregated dashboard data',
    description:
      'Returns the last 10 recent activity items (notifications + drive activity across all groups) and upcoming items (tasks with future due dates + calendar events from all groups) for the authenticated user.',
  })
  @ApiOkResponse({ type: DashboardResponseDto })
  getDashboard(
    @Req() req: Request & { user: JwtRequestUser },
  ): Promise<DashboardResponseDto> {
    return this.dashboardService.getDashboard(req.user.id);
  }
}
