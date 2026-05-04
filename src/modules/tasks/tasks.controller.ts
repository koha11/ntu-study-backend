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
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';
import { TasksService } from './tasks.service';
import { serializeTaskForApi } from './task-response.mapper';
import {
  CreateTaskDto,
  UpdateTaskDto,
  SubmitTaskDto,
  ApproveTaskDto,
} from './dto/task.dto';
import { TaskStatus } from '@common/enums';

@ApiTags('Tasks')
@ApiBearerAuth('JWT')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
  })
  create(@Req() req: Request, @Body() createTaskDto: CreateTaskDto) {
    const user = req.user as JwtRequestUser;
    return this.tasksService
      .create(user.id, createTaskDto)
      .then(serializeTaskForApi);
  }

  @Get()
  @ApiOperation({ summary: "Get current user's personal tasks or a group's tasks" })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by task status (personal list only)',
    enum: TaskStatus,
  })
  @ApiQuery({
    name: 'groupId',
    required: false,
    description: 'When set, returns root tasks for this group',
  })
  @ApiQuery({
    name: 'assignedInGroups',
    required: false,
    description: "When 'true', returns root group tasks assigned to or created by the user",
  })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved',
  })
  findMany(
    @Req() req: Request,
    @Query('groupId') groupId?: string,
    @Query('assignedInGroups') assignedInGroups?: string,
    @Query('status') status?: TaskStatus,
  ) {
    const user = req.user as JwtRequestUser;
    if (groupId) {
      return this.tasksService
        .findGroupTasks(groupId, user.id)
        .then((tasks) => tasks.map(serializeTaskForApi));
    }
    if (assignedInGroups === 'true') {
      return this.tasksService
        .findAssignedGroupTasks(user.id)
        .then((tasks) => tasks.map(serializeTaskForApi));
    }
    return this.tasksService
      .findPersonalTasks(user.id, status)
      .then((tasks) => tasks.map(serializeTaskForApi));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiResponse({
    status: 200,
    description: 'Task found',
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtRequestUser;
    return this.tasksService
      .findOne(id, user.id)
      .then(serializeTaskForApi);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update task details' })
  @ApiResponse({ status: 200, description: 'Task updated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.tasksService
      .update(id, user.id, updateTaskDto)
      .then(serializeTaskForApi);
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Submit task for review' })
  @ApiResponse({
    status: 200,
    description: 'Task submitted',
    schema: { example: { status: 'pending_review' } },
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  submitTask(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() _submitTaskDto: SubmitTaskDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.tasksService
      .submitTask(id, user.id)
      .then(serializeTaskForApi);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve submitted task (leader only)' })
  @ApiResponse({
    status: 200,
    description: 'Task approved',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  approveTask(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() approveTaskDto: ApproveTaskDto,
  ) {
    const user = req.user as JwtRequestUser;
    return this.tasksService
      .approveTask(id, user.id, approveTaskDto.status)
      .then(serializeTaskForApi);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete task' })
  @ApiResponse({ status: 204, description: 'Task deleted' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async deleteTask(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<void> {
    const user = req.user as JwtRequestUser;
    await this.tasksService.deleteTask(id, user.id);
  }
}
