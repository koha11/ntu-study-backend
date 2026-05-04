import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { Task } from '@modules/tasks/entities/task.entity';
import { CronJobRun } from '@modules/cron-jobs/entities/cron-job-run.entity';
import { CronJobRunStatus, UserRole } from '@common/enums';

const MAX_PAGE = 100;

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  role: UserRole;
  is_active: boolean;
  locked: boolean;
};

export type AdminGroupRow = {
  id: string;
  name: string;
  status: string;
  member_count: number;
  created_at: Date;
};

export type AdminDashboardDto = {
  totals: {
    users: number;
    groups: number;
    tasks: number;
  };
  /** Completed runs in the last 7 days, grouped by job name (for charts). */
  cron_jobs_last_7_days: Array<{
    job_name: string;
    runs: number;
    failures: number;
  }>;
  /** Recent persisted cron executions — serves as v1 “system log” for scheduling. */
  recent_cron_runs: Array<{
    id: string;
    job_name: string;
    started_at: Date;
    finished_at: Date | null;
    status: CronJobRunStatus;
    error_message: string | null;
    triggered_by: string;
  }>;
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(Group) private groupsRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private groupMembersRepository: Repository<GroupMember>,
    @InjectRepository(Task) private tasksRepository: Repository<Task>,
    @InjectRepository(CronJobRun)
    private cronJobRunsRepository: Repository<CronJobRun>,
  ) {}

  private clampTake(take: number): number {
    return Math.min(Math.max(take, 1), MAX_PAGE);
  }

  async findAllUsers(
    skip: number = 0,
    take: number = 20,
    q?: string,
  ): Promise<{ users: AdminUserRow[]; total: number }> {
    const takeClamped = this.clampTake(take);
    const qb = this.usersRepository
      .createQueryBuilder('u')
      .orderBy('u.created_at', 'DESC')
      .skip(skip)
      .take(takeClamped);

    const trimmed = q?.trim();
    if (trimmed) {
      const term = `%${trimmed}%`;
      qb.andWhere(
        '(u.email ILIKE :term OR u.full_name ILIKE :term)',
        { term },
      );
    }

    const [users, total] = await qb.getManyAndCount();

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        avatar_url: u.avatar_url,
        role: u.role,
        is_active: u.is_active,
        locked: !u.is_active,
      })),
      total,
    };
  }

  async lockUser(userId: string): Promise<AdminUserRow> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot lock another admin');
    }
    user.is_active = false;
    await this.usersRepository.save(user);
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      role: user.role,
      is_active: user.is_active,
      locked: !user.is_active,
    };
  }

  async unlockUser(userId: string): Promise<AdminUserRow> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.is_active = true;
    await this.usersRepository.save(user);
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      role: user.role,
      is_active: user.is_active,
      locked: !user.is_active,
    };
  }

  async findAllGroups(
    skip: number = 0,
    take: number = 20,
  ): Promise<{ groups: AdminGroupRow[]; total: number }> {
    const takeClamped = this.clampTake(take);
    const [groups, total] = await this.groupsRepository.findAndCount({
      order: { created_at: 'DESC' },
      skip,
      take: takeClamped,
    });

    const ids = groups.map((g) => g.id);
    let countMap = new Map<string, number>();
    if (ids.length > 0) {
      const rawCounts = await this.groupMembersRepository
        .createQueryBuilder('gm')
        .select('gm.group_id', 'group_id')
        .addSelect('COUNT(*)', 'cnt')
        .where('gm.group_id IN (:...ids)', { ids })
        .groupBy('gm.group_id')
        .getRawMany<{ group_id: string; cnt: string }>();
      countMap = new Map(
        rawCounts.map((r) => [r.group_id, parseInt(r.cnt, 10)]),
      );
    }

    return {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        status: g.status,
        member_count: countMap.get(g.id) ?? 0,
        created_at: g.created_at,
      })),
      total,
    };
  }

  async deleteGroup(groupId: string): Promise<void> {
    const res = await this.groupsRepository.delete(groupId);
    if (!res.affected) {
      throw new NotFoundException('Group not found');
    }
  }

  async getDashboard(): Promise<AdminDashboardDto> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [total_users, total_groups, total_tasks] = await Promise.all([
      this.usersRepository.count(),
      this.groupsRepository.count(),
      this.tasksRepository.count(),
    ]);

    const statsRows = await this.cronJobRunsRepository
      .createQueryBuilder('r')
      .select('r.job_name', 'job_name')
      .addSelect('COUNT(*)', 'runs')
      .addSelect(
        `COALESCE(SUM(CASE WHEN r.status = :failure THEN 1 ELSE 0 END), 0)`,
        'failures',
      )
      .where('r.started_at >= :since', { since })
      .andWhere('r.status IN (:...done)', {
        done: [CronJobRunStatus.SUCCESS, CronJobRunStatus.FAILURE],
      })
      .setParameter('failure', CronJobRunStatus.FAILURE)
      .groupBy('r.job_name')
      .getRawMany<{ job_name: string; runs: string; failures: string }>();

    const recent = await this.cronJobRunsRepository.find({
      order: { started_at: 'DESC' },
      take: 50,
    });

    return {
      totals: {
        users: total_users,
        groups: total_groups,
        tasks: total_tasks,
      },
      cron_jobs_last_7_days: statsRows.map((row) => ({
        job_name: row.job_name,
        runs: parseInt(row.runs, 10),
        failures: parseInt(row.failures ?? '0', 10),
      })),
      recent_cron_runs: recent.map((r) => ({
        id: r.id,
        job_name: r.job_name,
        started_at: r.started_at,
        finished_at: r.finished_at,
        status: r.status,
        error_message: r.error_message,
        triggered_by: r.triggered_by,
      })),
    };
  }
}
