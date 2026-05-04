import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContributionRating } from './entities/contribution-rating.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { User } from '@modules/users/entities/user.entity';

export interface EvaluationRoundRow {
  round_started_at: string;
  due_date: string;
  is_round_closed: boolean;
  rated_count: number;
  total_count: number;
}

export interface MyRatingRow {
  ratee_id: string;
  ratee_full_name: string;
  score: number | null;
}

export interface AggregatedRatingRow {
  ratee_id: string;
  ratee_full_name: string;
  average_score: number | null;
}

@Injectable()
export class ContributionsService {
  constructor(
    @InjectRepository(ContributionRating)
    private readonly ratingsRepository: Repository<ContributionRating>,
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly membersRepository: Repository<GroupMember>,
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

    const userIds = await this.getActiveMemberUserIds(groupId);
    if (userIds.length < 2) {
      throw new BadRequestException(
        'At least two active members are required to open peer evaluation',
      );
    }

    const roundStartedAt = new Date();

    const rows: ContributionRating[] = [];
    for (const raterId of userIds) {
      for (const rateeId of userIds) {
        if (raterId === rateeId) {
          continue;
        }
        rows.push(
          this.ratingsRepository.create({
            group: { id: groupId } as Group,
            rater: { id: raterId } as User,
            ratee: { id: rateeId } as User,
            round_started_at: roundStartedAt,
            due_date: dueDate,
            is_round_closed: false,
            score: null,
          }),
        );
      }
    }

    await this.ratingsRepository.save(rows);

    return {
      round_started_at: roundStartedAt.toISOString(),
      due_date: dueDate.toISOString(),
      ratings_created: rows.length,
    };
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

    return { updated: result.affected };
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
      .innerJoinAndSelect('cr.ratee', 'ratee')
      .where('cr.group_id = :groupId', { groupId })
      .andWhere('cr.round_started_at = :roundStartedAt', { roundStartedAt })
      .andWhere('cr.rater_id = :userId', { userId })
      .orderBy('cr.ratee_id', 'ASC')
      .getMany();

    if (rows.length === 0) {
      throw new NotFoundException('Evaluation round not found for this group');
    }

    return rows.map((r) => ({
      ratee_id: r.ratee.id,
      ratee_full_name: r.ratee?.full_name?.trim() ?? '',
      score: r.score,
    }));
  }

  async submitRating(
    groupId: string,
    roundStartedAt: Date,
    raterId: string,
    rateeId: string,
    score: number,
  ): Promise<{ ok: true }> {
    const group = await this.requireGroup(groupId);
    await this.assertCanAccessGroup(groupId, group, raterId);

    if (raterId === rateeId) {
      throw new BadRequestException('Cannot rate yourself');
    }

    const row = await this.ratingsRepository.findOne({
      where: {
        group: { id: groupId },
        round_started_at: roundStartedAt,
        rater: { id: raterId },
        ratee: { id: rateeId },
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
      .innerJoin('cr.ratee', 'ratee')
      .select('cr.ratee_id', 'ratee_id')
      .addSelect('ratee.full_name', 'ratee_full_name')
      .addSelect('ROUND(AVG(cr.score)::numeric, 2)', 'average_score')
      .where('cr.group_id = :groupId', { groupId })
      .andWhere('cr.round_started_at = :roundStartedAt', { roundStartedAt })
      .andWhere('cr.score IS NOT NULL')
      .groupBy('cr.ratee_id')
      .addGroupBy('ratee.full_name')
      .orderBy('cr.ratee_id', 'ASC')
      .getRawMany<{
        ratee_id: string;
        ratee_full_name: string;
        average_score: string | null;
      }>();

    return raw.map((r) => ({
      ratee_id: r.ratee_id,
      ratee_full_name: r.ratee_full_name ?? '',
      average_score:
        r.average_score != null ? parseFloat(r.average_score) : null,
    }));
  }
}
