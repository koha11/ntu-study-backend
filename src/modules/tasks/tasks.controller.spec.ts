import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { TaskStatus } from '@common/enums';
import type { Task } from './entities/task.entity';

describe('TasksController', () => {
  let controller: TasksController;
  let tasksService: {
    create: ReturnType<typeof vi.fn>;
    findPersonalTasks: ReturnType<typeof vi.fn>;
    findGroupTasks: ReturnType<typeof vi.fn>;
    findAssignedGroupTasks: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    submitTask: ReturnType<typeof vi.fn>;
    approveTask: ReturnType<typeof vi.fn>;
    deleteTask: ReturnType<typeof vi.fn>;
  };

  const userId = 'user-1111-1111-1111-111111111111';

  beforeEach(async () => {
    tasksService = {
      create: vi.fn(),
      findPersonalTasks: vi.fn(),
      findGroupTasks: vi.fn(),
      findAssignedGroupTasks: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      submitTask: vi.fn(),
      approveTask: vi.fn(),
      deleteTask: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: tasksService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TasksController);
  });

  it('create forwards jwt user id and dto', async () => {
    tasksService.create.mockResolvedValue({ id: 't1' });

    await controller.create({ user: { id: userId } } as never, {
      title: 'Hello',
    } as never);

    expect(tasksService.create).toHaveBeenCalledWith(userId, {
      title: 'Hello',
    });
  });

  it('findMany calls findGroupTasks when groupId query present', async () => {
    tasksService.findGroupTasks.mockResolvedValue([]);

    await controller.findMany(
      { user: { id: userId } } as never,
      'g1',
      undefined,
      undefined,
    );

    expect(tasksService.findGroupTasks).toHaveBeenCalledWith('g1', userId);
    expect(tasksService.findPersonalTasks).not.toHaveBeenCalled();
  });

  it('findMany calls findPersonalTasks when no groupId', async () => {
    tasksService.findPersonalTasks.mockResolvedValue([]);

    await controller.findMany(
      { user: { id: userId } } as never,
      undefined,
      undefined,
      undefined,
    );

    expect(tasksService.findPersonalTasks).toHaveBeenCalledWith(
      userId,
      undefined,
    );
    expect(tasksService.findGroupTasks).not.toHaveBeenCalled();
  });

  it('findMany passes status to findPersonalTasks', async () => {
    tasksService.findPersonalTasks.mockResolvedValue([]);

    await controller.findMany(
      { user: { id: userId } } as never,
      undefined,
      undefined,
      TaskStatus.TODO,
    );

    expect(tasksService.findPersonalTasks).toHaveBeenCalledWith(
      userId,
      TaskStatus.TODO,
    );
  });

  it('findMany calls findAssignedGroupTasks when assignedInGroups=true', async () => {
    tasksService.findAssignedGroupTasks.mockResolvedValue([]);

    await controller.findMany(
      { user: { id: userId } } as never,
      undefined,
      'true',
      undefined,
    );

    expect(tasksService.findAssignedGroupTasks).toHaveBeenCalledWith(userId);
    expect(tasksService.findPersonalTasks).not.toHaveBeenCalled();
  });

  it('findOne forwards id and user', async () => {
    tasksService.findOne.mockResolvedValue({
      id: 'tid',
      title: 'T',
      created_at: new Date(),
      updated_at: new Date(),
      created_by_id: userId,
      status: TaskStatus.TODO,
      subtasks: [],
    } as Task);

    await controller.findOne({ user: { id: userId } } as never, 'tid');

    expect(tasksService.findOne).toHaveBeenCalledWith('tid', userId);
  });

  it('update forwards ids and dto', async () => {
    tasksService.update.mockResolvedValue({
      id: 'tid',
      title: 'X',
      created_at: new Date(),
      updated_at: new Date(),
      created_by_id: userId,
      status: TaskStatus.TODO,
      subtasks: [],
    } as Task);

    await controller.update(
      { user: { id: userId } } as never,
      'tid',
      { title: 'X' } as never,
    );

    expect(tasksService.update).toHaveBeenCalledWith('tid', userId, {
      title: 'X',
    });
  });

  it('submitTask forwards id and user', async () => {
    tasksService.submitTask.mockResolvedValue({
      id: 'tid',
      title: 'T',
      created_at: new Date(),
      updated_at: new Date(),
      created_by_id: userId,
      status: TaskStatus.PENDING_REVIEW,
      subtasks: [],
    } as Task);

    await controller.submitTask({ user: { id: userId } } as never, 'tid', {});

    expect(tasksService.submitTask).toHaveBeenCalledWith('tid', userId);
  });

  it('approveTask forwards id, user, and status', async () => {
    tasksService.approveTask.mockResolvedValue({
      id: 'tid',
      title: 'T',
      created_at: new Date(),
      updated_at: new Date(),
      created_by_id: userId,
      status: TaskStatus.DONE,
      subtasks: [],
    } as Task);

    await controller.approveTask(
      { user: { id: userId } } as never,
      'tid',
      { status: TaskStatus.DONE } as never,
    );

    expect(tasksService.approveTask).toHaveBeenCalledWith(
      'tid',
      userId,
      TaskStatus.DONE,
    );
  });

  it('deleteTask forwards id and user', async () => {
    await controller.deleteTask({ user: { id: userId } } as never, 'tid');

    expect(tasksService.deleteTask).toHaveBeenCalledWith('tid', userId);
  });
});
