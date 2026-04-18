import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import {
  CreateGroupDto,
  UpdateGroupDto,
  InviteMemberDto,
} from './dto/group.dto';

@ApiTags('Groups')
@ApiBearerAuth('JWT')
@Controller('groups')
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
  create(@Body() _createGroupDto: CreateGroupDto) {
    // TODO: Create group
    return {};
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
  findUserGroups() {
    // TODO: Get user's groups
    return [];
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group details' })
  @ApiResponse({ status: 200, description: 'Group found' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  findOne(@Param('id') _id: string) {
    // TODO: Get group by id
    return {};
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update group (leader only)' })
  @ApiResponse({ status: 200, description: 'Group updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  update(@Param('id') _id: string, @Body() _updateGroupDto: UpdateGroupDto) {
    // TODO: Update group
    return {};
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
  getMembers(@Param('id') _id: string) {
    // TODO: Get group members
    return [];
  }

  @Post(':id/members/invite')
  @ApiOperation({ summary: 'Invite member to group (leader only)' })
  @ApiResponse({
    status: 201,
    description: 'Invitation sent',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  inviteMember(
    @Param('id') _id: string,
    @Body() _inviteMemberDto: InviteMemberDto,
  ) {
    // TODO: Invite member
    return {};
  }

  @Patch(':groupId/members/:userId/toggle')
  @ApiOperation({ summary: 'Toggle member active status (leader only)' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  toggleMemberStatus(
    @Param('groupId') _groupId: string,
    @Param('userId') _userId: string,
  ) {
    // TODO: Toggle member status
    return {};
  }
}
