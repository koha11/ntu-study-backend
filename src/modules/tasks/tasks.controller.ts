import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  SubmitTaskDto,
  ApproveTaskDto,
} from './dto/task.dto';

@ApiTags('Tasks')
@ApiBearerAuth('JWT')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
    schema: {
      example: {
        id: 'task-id-uuid',
        title: 'Complete assignment',
        status: 'todo',
        due_date: '2026-04-25T23:59:59Z',
      },
    },
  })
  create(@Body() _createTaskDto: CreateTaskDto) {
    // TODO: Create task
    return {};
  }

  @Get()
  @ApiOperation({ summary: "Get user's tasks with optional filtering" })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by task status (todo, in_progress, completed)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved',
    schema: {
      example: [
        {
          id: 'task-id-uuid',
          title: 'Complete assignment',
          status: 'todo',
          due_date: '2026-04-25T23:59:59Z',
        },
      ],
    },
  })
  findUserTasks(@Query('status') _status?: string) {
    // TODO: Get user's tasks
    return [];
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiResponse({
    status: 200,
    description: 'Task found',
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  findOne(@Param('id') _id: string) {
    // TODO: Get task by id
    return {};
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update task details' })
  @ApiResponse({ status: 200, description: 'Task updated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  update(@Param('id') _id: string, @Body() _updateTaskDto: UpdateTaskDto) {
    // TODO: Update task
    return {};
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Submit task for review' })
  @ApiResponse({
    status: 200,
    description: 'Task submitted',
    schema: { example: { status: 'pending_review' } },
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  submitTask(@Param('id') _id: string, @Body() _submitTaskDto: SubmitTaskDto) {
    // TODO: Submit task
    return {};
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve submitted task (leader only)' })
  @ApiResponse({
    status: 200,
    description: 'Task approved',
    schema: { example: { status: 'completed' } },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  approveTask(
    @Param('id') _id: string,
    @Body() _approveTaskDto: ApproveTaskDto,
  ) {
    // TODO: Approve task
    return {};
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete task' })
  @ApiResponse({ status: 200, description: 'Task deleted' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  deleteTask(@Param('id') _id: string) {
    // TODO: Delete task
    return {};
  }
}
