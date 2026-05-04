import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { TaskStatus } from '@common/enums';
import type { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { UsersService } from '@modules/users/users.service';
import { EmailService } from '@common/services/email.service';
import {
  NOTIFICATION_TYPE,
  RELATED_ENTITY_TYPE,
} from '@common/constants/notification-types';

const TASK_DETAIL_RELATIONS = [
  'assignee',
  'parent_task',
  'subtasks',
  'subtasks.assignee',
  'subtasks.parent_task',
] as const;

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(GroupMember)
    private readonly membersRepository: Repository<GroupMember>,
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async create(userId: string, dto: CreateTaskDto): Promise<Task> {
    let groupId: string | undefined = dto.group_id;
    let parentTaskId: string | undefined;

    if (dto.parent_task_id) {
      const parent = await this.tasksRepository.findOne({
        where: { id: dto.parent_task_id },
      });
      if (!parent) {
        throw new NotFoundException('Parent task not found');
      }
      if (parent.parent_task_id) {
        throw new BadRequestException(
          'Subtasks cannot have their own subtasks; nest only one level.',
        );
      }
      await this.assertCanEditTask(parent, userId);
      groupId = parent.group_id;
      parentTaskId = parent.id;
      if (dto.group_id && parent.group_id && dto.group_id !== parent.group_id) {
        throw new BadRequestException('group_id must match the parent task group');
      }
      if (dto.group_id && !parent.group_id) {
        throw new BadRequestException(
          'Cannot set group_id on a subtask of a personal task',
        );
      }
    }

    if (groupId) {
      await this.assertActiveMember(groupId, userId);
    }

    const task = this.tasksRepository.create({
      title: dto.title.trim(),
      description: dto.description?.trim(),
      group_id: groupId,
      parent_task_id: parentTaskId,
      created_by_id: userId,
      assignee_id: dto.assignee_id ?? userId,
      due_date: dto.due_date ? new Date(dto.due_date) : undefined,
      status: TaskStatus.TODO,
    });

    const saved = await this.tasksRepository.save(task);
    const reloaded =
      (await this.tasksRepository.findOne({
        where: { id: saved.id },
        relations: [...TASK_DETAIL_RELATIONS],
      })) ?? saved;
    await this.maybeNotifyGroupTaskAssigned(reloaded, userId);
    return reloaded;
  }

  async findOne(id: string, userId: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: [...TASK_DETAIL_RELATIONS],
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanAccessTask(task, userId);
    return task;
  }

  /** Personal tasks: no group, top-level only, visible to creator or assignee */
  async findPersonalTasks(
    userId: string,
    status?: TaskStatus,
  ): Promise<Task[]> {
    const qb = this.tasksRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.assignee', 'assignee')
      .leftJoinAndSelect('t.parent_task', 'parent_task')
      .leftJoinAndSelect('t.subtasks', 'subtasks')
      .leftJoinAndSelect('subtasks.assignee', 'subAssignee')
      .leftJoinAndSelect('subtasks.parent_task', 'subParent')
      .where('t.group_id IS NULL')
      .andWhere('t.parent_task_id IS NULL')
      .andWhere('(t.created_by_id = :uid OR t.assignee_id = :uid)', {
        uid: userId,
      })
      .orderBy('t.created_at', 'DESC');
    if (status) {
      qb.andWhere('t.status = :status', { status });
    }
    return qb.getMany();
  }

  /** Group board: root tasks only; caller must be leader or active member */
  async findGroupTasks(groupId: string, userId: string): Promise<Task[]> {
    await this.assertCanViewGroup(groupId, userId);
    return this.tasksRepository.find({
      where: { group_id: groupId, parent_task_id: IsNull() },
      relations: [...TASK_DETAIL_RELATIONS],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Root group tasks where the user is assignee or creator, limited to groups
   * they can access (active member or leader).
   */
  async findAssignedGroupTasks(userId: string): Promise<Task[]> {
    return this.tasksRepository
      .createQueryBuilder('t')
      .innerJoin(
        GroupMember,
        'm',
        'm.group_id = t.group_id AND m.user_id = :uid AND m.is_active = true',
        { uid: userId },
      )
      .leftJoinAndSelect('t.assignee', 'assignee')
      .leftJoinAndSelect('t.parent_task', 'parent_task')
      .leftJoinAndSelect('t.subtasks', 'subtasks')
      .leftJoinAndSelect('subtasks.assignee', 'subAssignee')
      .leftJoinAndSelect('subtasks.parent_task', 'subParent')
      .where('t.group_id IS NOT NULL')
      .andWhere('t.parent_task_id IS NULL')
      .andWhere('(t.assignee_id = :uid OR t.created_by_id = :uid)', {
        uid: userId,
      })
      .orderBy('t.created_at', 'DESC')
      .getMany();
  }

  async update(id: string, userId: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanEditTask(task, userId);

    const previousAssigneeId = task.assignee_id;

    if (task.group_id && dto.status !== undefined) {
      if (
        dto.status === TaskStatus.DONE ||
        dto.status === TaskStatus.FAILED ||
        dto.status === TaskStatus.PENDING_REVIEW
      ) {
        throw new BadRequestException(
          'Use POST/PATCH submit or approve endpoints for this status change on group tasks',
        );
      }
    }

    if (dto.title !== undefined) {
      task.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      task.description = dto.description?.trim();
    }
    if (dto.assignee_id !== undefined) {
      task.assignee_id = dto.assignee_id;
    }
    if (dto.due_date !== undefined) {
      task.due_date = dto.due_date ? new Date(dto.due_date) : undefined;
    }
    if (dto.status !== undefined) {
      task.status = dto.status;
    }

    await this.tasksRepository.save(task);
    const reloaded = await this.reloadTaskWithRelations(id);
    if (dto.assignee_id !== undefined) {
      await this.maybeNotifyAssigneeChange(
        reloaded,
        previousAssigneeId,
        userId,
      );
    }
    return reloaded;
  }

  async submitTask(id: string, userId: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.assertCanEditTask(task, userId);

    if (task.status !== TaskStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Task can only be submitted from in_progress status',
      );
    }

    task.status = TaskStatus.PENDING_REVIEW;
    task.submitted_at = new Date();
    await this.tasksRepository.save(task);
    const reloaded = await this.reloadTaskWithRelations(id);
    await this.maybeNotifyLeaderPendingReview(reloaded, userId);
    return reloaded;
  }

  async approveTask(
    id: string,
    leaderId: string,
    status: TaskStatus,
  ): Promise<Task> {
    if (status !== TaskStatus.DONE && status !== TaskStatus.FAILED) {
      throw new BadRequestException('Approval status must be done or failed');
    }

    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (!task.group_id) {
      throw new BadRequestException('Only group tasks can be approved');
    }
    if (task.status !== TaskStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Task must be pending_review to approve or fail',
      );
    }

    const group = await this.groupsRepository.findOne({
      where: { id: task.group_id },
    });
    if (!group || group.leader_id !== leaderId) {
      throw new ForbiddenException('Only the group leader can approve tasks');
    }

    task.status = status;
    task.reviewed_at = new Date();
    task.reviewed_by_id = leaderId;
    await this.tasksRepository.save(task);
    const reloaded = await this.reloadTaskWithRelations(id);
    await this.maybeNotifyAssigneeReviewResult(reloaded, group, status);
    return reloaded;
  }

  async deleteTask(id: string, userId: string): Promise<void> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.group_id) {
      const group = await this.groupsRepository.findOne({
        where: { id: task.group_id },
      });
      const isLeader = group?.leader_id === userId;
      const isCreator = task.created_by_id === userId;
      if (!isLeader && !isCreator) {
        throw new ForbiddenException('You cannot delete this task');
      }
    } else {
      if (task.created_by_id !== userId) {
        throw new ForbiddenException('You cannot delete this task');
      }
    }

    await this.tasksRepository.remove(task);
  }

  async findOverdueTasks(): Promise<Task[]> {
    const now = new Date();
    return this.tasksRepository
      .createQueryBuilder('t')
      .where('t.due_date IS NOT NULL')
      .andWhere('t.due_date < :now', { now })
      .andWhere('t.status IN (:...statuses)', {
        statuses: [
          TaskStatus.TODO,
          TaskStatus.IN_PROGRESS,
          TaskStatus.PENDING_REVIEW,
        ],
      })
      .getMany();
  }

  private async reloadTaskWithRelations(id: string): Promise<Task> {
    const fresh = await this.tasksRepository.findOne({
      where: { id },
      relations: [...TASK_DETAIL_RELATIONS],
    });
    if (!fresh) {
      throw new NotFoundException('Task not found');
    }
    return fresh;
  }

  private groupTasksUrl(groupId: string): string {
    const base =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ??
      'http://localhost:5173';
    return `${base}/groups/${groupId}`;
  }

  /** Group tasks only; skips self-assignment. */
  private async maybeNotifyGroupTaskAssigned(
    task: Task,
    actorUserId: string,
  ): Promise<void> {
    if (!task.group_id || !task.assignee_id || task.assignee_id === actorUserId) {
      return;
    }
    await this.sendAssigneeTaskAssigned(task, actorUserId);
  }

  private async maybeNotifyAssigneeChange(
    task: Task,
    previousAssigneeId: string | null | undefined,
    editorUserId: string,
  ): Promise<void> {
    if (!task.group_id || !task.assignee_id) {
      return;
    }
    if (task.assignee_id === previousAssigneeId) {
      return;
    }
    await this.sendAssigneeTaskAssigned(task, editorUserId);
  }

  private async sendAssigneeTaskAssigned(
    task: Task,
    editorUserId: string,
  ): Promise<void> {
    if (!task.group_id || !task.assignee_id || task.assignee_id === editorUserId) {
      return;
    }
    const group = await this.groupsRepository.findOne({
      where: { id: task.group_id },
    });
    if (!group) {
      return;
    }
    const assignee = await this.usersService.findOne(task.assignee_id);
    if (!assignee) {
      return;
    }
    const taskUrl = this.groupTasksUrl(group.id);
    await this.notificationsService.createNotification({
      recipient_id: assignee.id,
      type: NOTIFICATION_TYPE.TASK_ASSIGNED,
      message: `You were assigned "${task.title}" in ${group.name}`,
      related_entity_type: RELATED_ENTITY_TYPE.TASK,
      related_entity_id: task.id,
    });
    if (assignee.notification_enabled) {
      await this.emailService.sendTaskAssignedEmail({
        toEmail: assignee.email,
        taskTitle: task.title,
        groupName: group.name,
        taskUrl,
      });
    }
  }

  private async maybeNotifyLeaderPendingReview(
    task: Task,
    submitterUserId: string,
  ): Promise<void> {
    if (!task.group_id) {
      return;
    }
    const group = await this.groupsRepository.findOne({
      where: { id: task.group_id },
    });
    if (!group) {
      return;
    }
    const leader = await this.usersService.findOne(group.leader_id);
    if (!leader) {
      return;
    }
    const submitter = await this.usersService.findOne(submitterUserId);
    const submitterName = submitter?.full_name ?? 'Someone';
    const taskUrl = this.groupTasksUrl(group.id);
    await this.notificationsService.createNotification({
      recipient_id: leader.id,
      type: NOTIFICATION_TYPE.TASK_PENDING_REVIEW,
      message: `${submitterName} submitted "${task.title}" in ${group.name} for review`,
      related_entity_type: RELATED_ENTITY_TYPE.TASK,
      related_entity_id: task.id,
    });
    if (leader.notification_enabled) {
      await this.emailService.sendTaskPendingReviewEmail({
        toEmail: leader.email,
        taskTitle: task.title,
        groupName: group.name,
        submitterName,
        taskUrl,
      });
    }
  }

  private async maybeNotifyAssigneeReviewResult(
    task: Task,
    group: Group,
    status: TaskStatus,
  ): Promise<void> {
    if (!task.assignee_id) {
      return;
    }
    const assignee = await this.usersService.findOne(task.assignee_id);
    if (!assignee) {
      return;
    }
    const outcome = status === TaskStatus.DONE ? 'done' : 'failed';
    const label = outcome === 'done' ? 'approved (Done)' : 'marked as Failed';
    const taskUrl = this.groupTasksUrl(group.id);
    await this.notificationsService.createNotification({
      recipient_id: assignee.id,
      type: NOTIFICATION_TYPE.TASK_REVIEW_RESULT,
      message: `Your task "${task.title}" in ${group.name} was ${label}`,
      related_entity_type: RELATED_ENTITY_TYPE.TASK,
      related_entity_id: task.id,
    });
    if (assignee.notification_enabled) {
      await this.emailService.sendTaskReviewResultEmail({
        toEmail: assignee.email,
        taskTitle: task.title,
        groupName: group.name,
        outcome,
        taskUrl,
      });
    }
  }

  private async assertActiveMember(
    groupId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.membersRepository.findOne({
      where: { group_id: groupId, user_id: userId, is_active: true },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You must be an active group member to create tasks here',
      );
    }
  }

  private async assertCanViewGroup(
    groupId: string,
    userId: string,
  ): Promise<void> {
    const group = await this.groupsRepository.findOne({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    if (group.leader_id === userId) {
      return;
    }
    const membership = await this.membersRepository.findOne({
      where: { group_id: groupId, user_id: userId, is_active: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this group');
    }
  }

  private async assertCanAccessTask(task: Task, userId: string): Promise<void> {
    if (!task.group_id) {
      if (task.created_by_id !== userId && task.assignee_id !== userId) {
        throw new ForbiddenException('You do not have access to this task');
      }
      return;
    }
    await this.assertCanViewGroup(task.group_id, userId);
  }

  private async assertCanEditTask(task: Task, userId: string): Promise<void> {
    if (!task.group_id) {
      if (task.created_by_id !== userId && task.assignee_id !== userId) {
        throw new ForbiddenException('You cannot edit this task');
      }
      return;
    }

    const group = await this.groupsRepository.findOne({
      where: { id: task.group_id },
    });
    const isLeader = group?.leader_id === userId;
    const isCreator = task.created_by_id === userId;
    const isAssignee = task.assignee_id === userId;
    if (!isLeader && !isCreator && !isAssignee) {
      throw new ForbiddenException('You cannot edit this task');
    }
  }
}
