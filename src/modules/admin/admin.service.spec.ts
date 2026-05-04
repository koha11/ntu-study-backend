import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { User } from '@modules/users/entities/user.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { Task } from '@modules/tasks/entities/task.entity';
import { CronJobRun } from '@modules/cron-jobs/entities/cron-job-run.entity';
import { UserRole } from '@common/enums';
import { GroupStatus } from '@common/enums';
import { CronJobRunStatus } from '@common/enums';

describe('AdminService', () => {
  let service: AdminService;
  let usersRepo: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  let groupsRepo: {
    findAndCount: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  let groupMembersRepo: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let tasksRepo: { count: ReturnType<typeof vi.fn> };
  let cronRepo: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
  };

  const user = {
    id: 'u1',
    email: 'a@ntu.edu.sg',
    full_name: 'Alice',
    avatar_url: null,
    role: UserRole.USER,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  } as User;

  beforeEach(async () => {
    const qbUsers = {
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[user], 1]),
    };
    usersRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(qbUsers),
      findOne: vi.fn(),
      save: vi.fn(),
      count: vi.fn().mockResolvedValue(3),
    };

    const g = {
      id: 'g1',
      name: 'G',
      status: GroupStatus.ACTIVE,
      created_at: new Date(),
      updated_at: new Date(),
    } as Group;
    groupsRepo = {
      findAndCount: vi.fn().mockResolvedValue([[g], 5]),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      count: vi.fn().mockResolvedValue(5),
    };

    const qbGm = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi
        .fn()
        .mockResolvedValue([{ group_id: 'g1', cnt: '2' }]),
    };
    groupMembersRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(qbGm),
    };

    tasksRepo = {
      count: vi.fn().mockResolvedValue(10),
    };

    const qbCron = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      setParameter: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([
        {
          job_name: 'overdue-task-reminders',
          runs: '4',
          failures: '1',
        },
      ]),
    };
    cronRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(qbCron),
      find: vi.fn().mockResolvedValue([
        {
          id: 'r1',
          job_name: 'overdue-task-reminders',
          started_at: new Date(),
          finished_at: new Date(),
          status: CronJobRunStatus.SUCCESS,
          error_message: null,
          triggered_by: 'cron',
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Group), useValue: groupsRepo },
        { provide: getRepositoryToken(GroupMember), useValue: groupMembersRepo },
        { provide: getRepositoryToken(Task), useValue: tasksRepo },
        { provide: getRepositoryToken(CronJobRun), useValue: cronRepo },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it('findAllUsers maps locked from is_active', async () => {
    const out = await service.findAllUsers(0, 20);
    expect(out.users[0].locked).toBe(false);
    expect(out.total).toBe(1);
  });

  it('lockUser forbids targeting admin', async () => {
    usersRepo.findOne.mockResolvedValue({
      ...user,
      role: UserRole.ADMIN,
    });
    await expect(service.lockUser('u1')).rejects.toThrow(ForbiddenException);
  });

  it('lockUser sets inactive for normal user', async () => {
    usersRepo.findOne.mockResolvedValue({ ...user });
    usersRepo.save.mockImplementation((u: User) => Promise.resolve(u));

    const out = await service.lockUser('u1');

    expect(usersRepo.save).toHaveBeenCalled();
    expect(out.locked).toBe(true);
    expect(out.is_active).toBe(false);
  });

  it('deleteGroup throws when missing', async () => {
    groupsRepo.delete.mockResolvedValue({ affected: 0 });
    await expect(service.deleteGroup('x')).rejects.toThrow(NotFoundException);
  });

  it('getDashboard returns totals and cron sections', async () => {
    const d = await service.getDashboard();
    expect(d.totals.users).toBe(3);
    expect(d.totals.groups).toBe(5);
    expect(d.totals.tasks).toBe(10);
    expect(d.cron_jobs_last_7_days[0].failures).toBe(1);
    expect(d.recent_cron_runs).toHaveLength(1);
  });

  it('findAllGroups includes member_count', async () => {
    const out = await service.findAllGroups(0, 20);
    expect(out.groups[0].member_count).toBe(2);
    expect(out.total).toBe(5);
  });
});
