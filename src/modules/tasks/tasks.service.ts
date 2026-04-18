import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private tasksRepository: Repository<Task>,
  ) {}

  async create(_taskData: Partial<Task>): Promise<Task> {
    // TODO: Create task
    throw new Error('Not implemented');
  }

  async findOne(_id: string): Promise<Task> {
    // TODO: Find task by id
    throw new Error('Not implemented');
  }

  async findUserTasks(_userId: string, _status?: string): Promise<Task[]> {
    // TODO: Find user's tasks with optional status filter
    return [];
  }

  async update(_id: string, _taskData: Partial<Task>): Promise<Task> {
    // TODO: Update task
    throw new Error('Not implemented');
  }

  async submitTask(_id: string, _userId: string): Promise<Task> {
    // TODO: Submit task for review
    throw new Error('Not implemented');
  }

  async approveTask(
    _id: string,
    _leaderId: string,
    _status: string,
  ): Promise<Task> {
    // TODO: Approve task
    throw new Error('Not implemented');
  }

  async deleteTask(_id: string): Promise<void> {
    // TODO: Delete task
  }

  async findOverdueTasks(): Promise<Task[]> {
    // TODO: Find overdue tasks for cron notifications
    return [];
  }
}
