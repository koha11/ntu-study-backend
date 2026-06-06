import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, IsNull, Not, In } from 'typeorm';
import { ContributionRating } from './entities/contribution-rating.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { Task } from '@modules/tasks/entities/task.entity';
import { User } from '@modules/users/entities/user.entity';
import { Language, NotificationDeliveryChannel, TaskStatus } from '@common/enums';
import { EmailService } from '@common/services/email.service';
import { GroupEmailThreadService } from '@common/services/group-email-thread.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import {
  NOTIFICATION_TYPE,
  RELATED_ENTITY_TYPE,
} from '@common/constants/notification-types';

export interface EvaluationRoundRow {
  round_started_at: string;
  due_date: string;
  is_round_closed: boolean;
  rated_count: number;
  total_count: number;
}

export interface MyRatingRow {
  task_id: string;
  task_title: string;
  assignee_full_name: string;
  score: number | null;
}

export interface AggregatedRatingRow {
  assignee_id: string;
  assignee_full_name: string;
  average_score: number | null;
}

export interface MemberTaskScore {
  task_id: string;
  task_title: string;
  average_score: number | null;
}

@Injectable()
export class ContributionsService {
  private readonly logger = new Logger(ContributionsService.name);

  constructor(
    @InjectRepository(ContributionRating)
    private readonly ratingsRepository: Repository<ContributionRating>,
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly membersRepository: Repository<GroupMember>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly groupEmailThreadService: GroupEmailThreadService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  parseRoundStartedAt(param: string): Date {
    const decoded = decodeURIComponent(param);
    const d = new Date(decoded);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid round_started_at');
    }
    return d;
  }

  private async requireGroup(groupId: string): Promise<Group> {
    const group = await this.groupsRepository.findOne({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return group;
  }

  private async assertCanAccessGroup(
    groupId: string,
    group: Group,
    userId: string,
  ): Promise<void> {
    if (group.leader_id === userId) {
      return;
    }
    const membership = await this.membersRepository.findOne({
      where: {
        group_id: groupId,
        user_id: userId,
        is_active: true,
      },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this group');
    }
  }

  private assertLeader(group: Group, userId: string): void {
    if (group.leader_id !== userId) {
      throw new ForbiddenException(
        'Only the group leader can perform this action',
      );
    }
  }

  private async getActiveMemberUserIds(groupId: string): Promise<string[]> {
    const memberships = await this.membersRepository.find({
      where: { group_id: groupId, is_active: true },
      select: ['user_id'],
    });
    return memberships.map((m) => m.user_id);
  }

  /**
   * Get eligible DONE tasks for evaluation:
   * - Status is DONE
   * - Has an assignee
   * - Assignee is an active member of the group
   */
  private async getEligibleTasksForEvaluation(
    groupId: string,
  ): Promise<Task[]> {
    const activeUserIds = await this.getActiveMemberUserIds(groupId);
    if (activeUserIds.length === 0) {
      return [];
    }

    return this.tasksRepository
      .find({
        where: {
          group_id: groupId,
          status: TaskStatus.DONE,
          assignee_id: Not(IsNull()),
        },
      })
      .then((tasks) =>
        // Filter to only include tasks with assignees who are active members
        tasks.filter(
          (t) => t.assignee_id && activeUserIds.includes(t.assignee_id),
        ),
      );
  }

  async openEvaluation(
    groupId: string,
    leaderId: string,
    dueDateIso: string,
  ): Promise<{
    round_started_at: string;
    due_date: string;
    ratings_created: number;
  }> {
    const group = await this.requireGroup(groupId);
    this.assertLeader(group, leaderId);

    const dueDate = new Date(dueDateIso);
    if (Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException('Invalid due_date');
    }
    const now = new Date();
    if (dueDate.getTime() <= now.getTime()) {
      throw new BadRequestException('due_date must be in the future');
    }

    const activeUserIds = await this.getActiveMemberUserIds(groupId);
    if (activeUserIds.length < 2) {
      throw new BadRequestException(
        'At least two active members are required to open peer evaluation',
      );
    }

    const allEligibleTasks = await this.getEligibleTasksForEvaluation(groupId);
    if (allEligibleTasks.length === 0) {
      throw new BadRequestException(
        'No eligible DONE tasks with active assignees found for evaluation',
      );
    }

    // Exclude tasks already included in any previous evaluation round for this group
    const previouslyEvaluated = await this.ratingsRepository
      .createQueryBuilder('cr')
      .innerJoin('cr.task', 'task')
      .select('task.id', 'taskId')
      .distinct(true)
      .where('cr.group_id = :groupId', { groupId })
      .getRawMany<{ taskId: string }>();
    const previouslyEvaluatedTaskIds = new Set(
      previouslyEvaluated.map((r) => r.taskId),
    );

    const eligibleTasks = allEligibleTasks.filter(
      (task) => !previouslyEvaluatedTaskIds.has(task.id),
    );

    if (eligibleTasks.length === 0) {
      throw new BadRequestException(
        'All eligible tasks have already been evaluated in a previous round',
      );
    }

    const roundStartedAt = new Date();

    // For each eligible task, create a rating row for each rater (excluding the assignee)
    const rows: ContributionRating[] = [];
    for (const task of eligibleTasks) {
      for (const raterId of activeUserIds) {
        if (raterId === task.assignee_id) {
          continue;
        }

        rows.push(
          this.ratingsRepository.create({
            group: { id: groupId } as Group,
            task: { id: task.id } as Task,
            rater: { id: raterId } as User,
            round_started_at: roundStartedAt,
            due_date: dueDate,
            is_round_closed: false,
            score: null,
          }),
        );
      }
    }

    await this.ratingsRepository.save(rows);
    this.logger.log(`Evaluation round opened for group ${groupId}: ${rows.length} ratings created`);

    await this.notifyMembersEvaluationOpened(
      groupId,
      group,
      dueDate,
      activeUserIds,
    );

    return {
      round_started_at: roundStartedAt.toISOString(),
      due_date: dueDate.toISOString(),
      ratings_created: rows.length,
    };
  }

  private async notifyMembersEvaluationOpened(
    groupId: string,
    group: Group,
    dueDate: Date,
    activeUserIds: string[],
  ): Promise<void> {
    const base =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ??
      'http://localhost:5173';
    const groupUrl = `${base}/groups/${groupId}`;

    const users = await this.usersRepository.find({
      where: { id: In(activeUserIds) },
    });

    for (const user of users) {
      if (user.notification_enabled === false) {
        continue;
      }
      const thread = await this.groupEmailThreadService.findByGroupAndUser(
        groupId,
        user.id,
      );
      await this.emailService.sendContributionOpenEmail({
        toEmail: user.email,
        groupName: group.name,
        dueDate,
        groupUrl,
        threadMessageId: thread?.thread_message_id,
        lang: user.preferred_language,
      });
    }
  }

  async closeEvaluation(
    groupId: string,
    leaderId: string,
    roundStartedAt: Date,
  ): Promise<{ updated: number }> {
    const group = await this.requireGroup(groupId);
    this.assertLeader(group, leaderId);

    const result = await this.ratingsRepository
      .createQueryBuilder()
      .update(ContributionRating)
      .set({ is_round_closed: true })
      .where('group_id = :groupId', { groupId })
      .andWhere('round_started_at = :roundStartedAt', { roundStartedAt })
      .execute();

    if (!result.affected || result.affected === 0) {
      throw new NotFoundException('Evaluation round not found for this group');
    }

    const activeUserIds = await this.getActiveMemberUserIds(groupId);
    await this.notifyMembersEvaluationClosed(
      groupId,
      group,
      roundStartedAt,
      activeUserIds,
    );

    this.logger.log(`Evaluation round closed for group ${groupId}: ${result.affected} ratings updated`);
    return { updated: result.affected };
  }

  private async getMemberTaskScores(
    groupId: string,
    roundStartedAt: Date,
    memberId: string,
  ): Promise<MemberTaskScore[]> {
    const raw = await this.ratingsRepository
      .createQueryBuilder('cr')
      .innerJoin('cr.task', 'task')
      .select('task.id', 'task_id')
      .addSelect('task.title', 'task_title')
      .addSelect('ROUND(AVG(cr.score)::numeric, 2)', 'average_score')
      .where('cr.group_id = :groupId', { groupId })
      .andWhere('cr.round_started_at = :roundStartedAt', { roundStartedAt })
      .andWhere('task.assignee_id = :memberId', { memberId })
      .andWhere('cr.score IS NOT NULL')
      .groupBy('task.id')
      .addGroupBy('task.title')
      .orderBy('task.title', 'ASC')
      .getRawMany<{
        task_id: string;
        task_title: string;
        average_score: string | null;
      }>();

    return raw.map((r) => ({
      task_id: r.task_id,
      task_title: r.task_title,
      average_score:
        r.average_score !== null ? parseFloat(r.average_score) : null,
    }));
  }

  private async notifyMembersEvaluationClosed(
    groupId: string,
    group: Group,
    roundStartedAt: Date,
    activeUserIds: string[],
  ): Promise<void> {
    const base =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ??
      'http://localhost:5173';
    const groupUrl = `${base}/groups/${groupId}`;

    const users = await this.usersRepository.find({
      where: { id: In(activeUserIds) },
    });

    for (const user of users) {
      const taskScores = await this.getMemberTaskScores(
        groupId,
        roundStartedAt,
        user.id,
      );
      if (taskScores.length === 0) {
        continue;
      }

      const scored = taskScores.filter((t) => t.average_score !== null);
      const overallAverage =
        scored.length > 0
          ? Math.round(
              (scored.reduce((sum, t) => sum + (t.average_score as number), 0) /
                scored.length) *
                100,
            ) / 100
          : null;

      const vi = user.preferred_language !== Language.EN;
      const scoreLabel = overallAverage !== null ? `${overallAverage}/10` : '—';
      const message = vi
        ? `Vòng đánh giá đóng góp của nhóm "${group.name}" đã kết thúc. Điểm tổng của bạn: ${scoreLabel}.`
        : `Peer evaluation for group "${group.name}" has closed. Your overall score: ${scoreLabel}.`;

      await this.notificationsService.createNotification({
        recipient_id: user.id,
        type: NOTIFICATION_TYPE.EVALUATION_CLOSED,
        message,
        related_entity_type: RELATED_ENTITY_TYPE.CONTRIBUTION_EVALUATION,
        related_entity_id: groupId,
        delivery_channel: NotificationDeliveryChannel.BOTH,
      });

      if (user.notification_enabled === false) {
        continue;
      }

      const thread = await this.groupEmailThreadService.findByGroupAndUser(
        groupId,
        user.id,
      );
      await this.emailService.sendContributionClosedEmail({
        toEmail: user.email,
        groupName: group.name,
        taskScores: taskScores.map((t) => ({
          taskTitle: t.task_title,
          averageScore: t.average_score,
        })),
        overallAverage,
        groupUrl,
        threadMessageId: thread?.thread_message_id,
        lang: user.preferred_language,
      });
    }
  }

  async listRounds(
    groupId: string,
    userId: string,
  ): Promise<EvaluationRoundRow[]> {
    const group = await this.requireGroup(groupId);
    await this.assertCanAccessGroup(groupId, group, userId);

    const raw = await this.ratingsRepository
      .createQueryBuilder('cr')
      .select('cr.round_started_at', 'round_started_at')
      .addSelect('MIN(cr.due_date)', 'due_date')
      .addSelect('BOOL_OR(cr.is_round_closed)', 'is_round_closed')
      .addSelect('COUNT(*)', 'total_count')
      .addSelect(
        'SUM(CASE WHEN cr.score IS NOT NULL THEN 1 ELSE 0 END)',
        'rated_count',
      )
      .where('cr.group_id = :groupId', { groupId })
      .groupBy('cr.round_started_at')
      .orderBy('cr.round_started_at', 'DESC')
      .getRawMany<{
        round_started_at: Date;
        due_date: Date;
        is_round_closed: boolean;
        total_count: string;
        rated_count: string | null;
      }>();

    return raw.map((r) => ({
      round_started_at: new Date(r.round_started_at).toISOString(),
      due_date: new Date(r.due_date).toISOString(),
      is_round_closed: Boolean(r.is_round_closed),
      rated_count: parseInt(r.rated_count ?? '0', 10),
      total_count: parseInt(r.total_count, 10),
    }));
  }

  async getMyRatingsForRound(
    groupId: string,
    roundStartedAt: Date,
    userId: string,
  ): Promise<MyRatingRow[]> {
    const group = await this.requireGroup(groupId);
    await this.assertCanAccessGroup(groupId, group, userId);

    const rows = await this.ratingsRepository
      .createQueryBuilder('cr')
      .innerJoinAndSelect('cr.task', 'task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('cr.group_id = :groupId', { groupId })
      .andWhere('cr.round_started_at = :roundStartedAt', { roundStartedAt })
      .andWhere('cr.rater_id = :userId', { userId })
      .orderBy('task.title', 'ASC')
      .getMany();

    if (rows.length === 0) {
      throw new NotFoundException('Evaluation round not found for this group');
    }

    return rows.map((r) => ({
      task_id: r.task.id,
      task_title: r.task.title,
      assignee_full_name: r.task.assignee?.full_name?.trim() ?? '',
      score: r.score,
    }));
  }

  async submitRating(
    groupId: string,
    roundStartedAt: Date,
    raterId: string,
    taskId: string,
    score: number,
  ): Promise<{ ok: true }> {
    const group = await this.requireGroup(groupId);
    await this.assertCanAccessGroup(groupId, group, raterId);

    const row = await this.ratingsRepository.findOne({
      where: {
        group: { id: groupId },
        round_started_at: roundStartedAt,
        rater: { id: raterId },
        task: { id: taskId },
      },
    });

    if (!row) {
      throw new NotFoundException('Rating not found for this round');
    }

    if (row.is_round_closed) {
      throw new ForbiddenException('This evaluation round is closed');
    }

    const now = new Date();
    if (now.getTime() > row.due_date.getTime()) {
      throw new ForbiddenException('The evaluation deadline has passed');
    }

    row.score = score;
    await this.ratingsRepository.save(row);
    this.logger.log(`Rating submitted for task ${taskId} in group ${groupId} by rater ${raterId}: score ${score}`);
    return { ok: true };
  }

  async getAggregatedResults(
    groupId: string,
    roundStartedAt: Date,
    userId: string,
  ): Promise<AggregatedRatingRow[]> {
    const group = await this.requireGroup(groupId);
    await this.assertCanAccessGroup(groupId, group, userId);

    const sample = await this.ratingsRepository.findOne({
      where: { group: { id: groupId }, round_started_at: roundStartedAt },
    });

    if (!sample) {
      throw new NotFoundException('Evaluation round not found for this group');
    }

    if (!sample.is_round_closed) {
      throw new ForbiddenException(
        'Results are available after the leader closes this round',
      );
    }

    const raw = await this.ratingsRepository
      .createQueryBuilder('cr')
      .innerJoin('cr.task', 'task')
      .innerJoin('task.assignee', 'assignee')
      .select('task.assignee_id', 'assignee_id')
      .addSelect('assignee.full_name', 'assignee_full_name')
      .addSelect('ROUND(AVG(cr.score)::numeric, 2)', 'average_score')
      .where('cr.group_id = :groupId', { groupId })
      .andWhere('cr.round_started_at = :roundStartedAt', { roundStartedAt })
      .andWhere('cr.score IS NOT NULL')
      .groupBy('task.assignee_id')
      .addGroupBy('assignee.full_name')
      .orderBy('task.assignee_id', 'ASC')
      .getRawMany<{
        assignee_id: string;
        assignee_full_name: string;
        average_score: string | null;
      }>();

    return raw.map((r) => ({
      assignee_id: r.assignee_id,
      assignee_full_name: r.assignee_full_name ?? '',
      average_score:
        r.average_score != null ? parseFloat(r.average_score) : null,
    }));
  }
}
