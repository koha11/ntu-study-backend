import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';
import { GroupsService } from './groups.service';
import {
  CreateGroupDto,
  CreateGroupCalendarEventDto,
  CreateMeetEventDto,
  ListGroupCalendarEventsQueryDto,
  UpdateGroupDto,
  InviteMemberDto,
} from './dto/group.dto';

@ApiTags('Groups')
@ApiBearerAuth('JWT')
@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new study group' })
  @ApiResponse({
    status: 201,
    description: 'Group created successfully',
    schema: {
      example: {
        id: 'group-id-uuid',
        name: 'CS2040S Study Group',
        description: 'Data structures course',
        created_at: '2026-04-18T00:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  create(@Req() req: Request, @Body() createGroupDto: CreateGroupDto) {
    const user = req.user as JwtRequestUser;
    return this.groupsService.create(user.id, createGroupDto);
  }

  @Get()
  @ApiOperation({ summary: "Get user's study groups" })
  @ApiResponse({
    status: 200,
    description: 'Groups retrieved',
    schema: {
      example: [
        {
          id: 'group-id-uuid',
          name: 'CS2040S Study Group',
          member_count: 5,
        },
      ],
    },
  })
  findUserGroups(@Req() req: Request) {
    const user = req.user as JwtRequestUser;
    return this.groupsService.findUserGroups(user.id);
  }

  @Get(':id/calendar/events')
  @ApiOperation({
    summary:
      'List events from the group shared Google Calendar (proxied via leader token)',
  })
  @ApiResponse({ status: 200, description: 'Events listed' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  listCalendarEvents(
    @Req() req: Request,
    @Param('id') id: string,
    @Query() query: ListGroupCalendarEventsQueryDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.groupsService.listGroupCalendarEvents(
      id,
      user.id,
      query.time_min,
      query.time_max,
    );
  }

  @Post(':id/calendar/events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an event on the group shared calendar (leader only)' })
  @ApiResponse({ status: 201, description: 'Event created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  createGroupCalendarEvent(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: CreateGroupCalendarEventDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.groupsService.createGroupCalendarEventAndInvite(
      id,
      user.id,
      body,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group details' })
  @ApiResponse({ status: 200, description: 'Group found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtRequestUser;
    return this.groupsService.findOneForMember(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update group (leader only)' })
  @ApiResponse({ status: 200, description: 'Group updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.groupsService.update(id, user.id, updateGroupDto);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get group members' })
  @ApiResponse({
    status: 200,
    description: 'Members retrieved',
    schema: {
      example: [
        {
          user_id: 'user-id-uuid',
          full_name: 'John Doe',
          role: 'leader',
          joined_at: '2026-04-18T00:00:00Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  getMembers(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtRequestUser;
    return this.groupsService.getMembers(id, user.id);
  }

  @Post(':id/calendar/meet-event')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a one-off Google Calendar event with Meet and invite active members (leader only)',
  })
  @ApiResponse({ status: 201, description: 'Event created' })
  @ApiResponse({ status: 400, description: 'Invalid input or Calendar error' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  createMeetEvent(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() createMeetEventDto: CreateMeetEventDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.groupsService.createMeetEventAndInvite(
      id,
      user.id,
      createMeetEventDto,
    );
  }

  @Post(':id/members/invite')
  @ApiOperation({ summary: 'Invite member to group (leader only)' })
  @ApiResponse({
    status: 201,
    description: 'Invitation sent',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  inviteMember(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() inviteMemberDto: InviteMemberDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.groupsService.inviteMember(id, user.id, inviteMemberDto.email);
  }

  @Patch(':id/members/:userId/toggle')
  @ApiOperation({ summary: 'Toggle member active status (leader only)' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  toggleMemberStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    const user = req.user as JwtRequestUser;
    return this.groupsService.toggleMemberStatus(id, user.id, userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from group (leader only)' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async removeMember(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    const user = req.user as JwtRequestUser;
    await this.groupsService.removeMember(id, user.id, userId);
  }
}
