import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { AdminGuard } from '@modules/auth/guards/admin.guard';
import { TaskSchedulerService } from '@common/services/task-scheduler.service';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: {
    findAllUsers: ReturnType<typeof vi.fn>;
    lockUser: ReturnType<typeof vi.fn>;
    unlockUser: ReturnType<typeof vi.fn>;
    findAllGroups: ReturnType<typeof vi.fn>;
    deleteGroup: ReturnType<typeof vi.fn>;
    getDashboard: ReturnType<typeof vi.fn>;
  };
  let taskSchedulerService: { runJobBySlug: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    adminService = {
      findAllUsers: vi.fn(),
      lockUser: vi.fn(),
      unlockUser: vi.fn(),
      findAllGroups: vi.fn(),
      deleteGroup: vi.fn(),
      getDashboard: vi.fn(),
    };
    taskSchedulerService = {
      runJobBySlug: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: adminService },
        { provide: TaskSchedulerService, useValue: taskSchedulerService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminController);
  });

  it('findAllUsers forwards skip, take, q', async () => {
    adminService.findAllUsers.mockResolvedValue({ users: [], total: 0 });
    await controller.findAllUsers(10, 25, 'foo');
    expect(adminService.findAllUsers).toHaveBeenCalledWith(10, 25, 'foo');
  });

  it('lockUser forwards id', async () => {
    adminService.lockUser.mockResolvedValue({} as never);
    await controller.lockUser('uid');
    expect(adminService.lockUser).toHaveBeenCalledWith('uid');
  });

  it('deleteGroup forwards id', async () => {
    await controller.deleteGroup('gid');
    expect(adminService.deleteGroup).toHaveBeenCalledWith('gid');
  });

  it('runCronJob forwards slug to scheduler', async () => {
    await controller.runCronJob('overdue-task-reminders');
    expect(taskSchedulerService.runJobBySlug).toHaveBeenCalledWith(
      'overdue-task-reminders',
    );
  });
});
