import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskOutcomeLink } from './entities/task-outcome-link.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupStatus, TaskStatus } from '@common/enums';
import type { AddOutcomeLinkDto, CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { UsersService } from '@modules/users/users.service';
import { EmailService } from '@common/services/email.service';
import { GoogleDriveService as CommonGoogleDriveService } from '@common/services/google-drive.service';
import { GoogleAccessTokenService } from '@modules/auth/services/google-access-token.service';
import { GroupEmailThreadService } from '@common/services/group-email-thread.service';
import {
  NOTIFICATION_TYPE,
  RELATED_ENTITY_TYPE,
} from '@common/constants/notification-types';

export interface DriveFileDto {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
}

const TASK_DETAIL_RELATIONS = [
  'assignee',
  'parent_task',
  'subtasks',
  'subtasks.assignee',
  'subtasks.parent_task',
] as const;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(TaskOutcomeLink)
    private readonly outcomeLinkRepository: Repository<TaskOutcomeLink>,
    @InjectRepository(GroupMember)
    private readonly membersRepository: Repository<GroupMember>,
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly groupEmailThreadService: GroupEmailThreadService,
    private readonly commonGoogleDriveService: CommonGoogleDriveService,
    private readonly googleAccessTokenService: GoogleAccessTokenService,
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
        throw new BadRequestException(
          'group_id must match the parent task group',
        );
      }
      if (dto.group_id && !parent.group_id) {
        throw new BadRequestException(
          'Cannot set group_id on a subtask of a personal task',
        );
      }
    }

    if (groupId) {
      await this.assertActiveMember(groupId, userId);
      await this.assertGroupNotLocked(groupId);
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
      expected_outcome_type: dto.expected_outcome_type,
      expected_outcome_description: dto.expected_outcome_description?.trim(),
    });

    const saved = await this.tasksRepository.save(task);

    if (groupId && !parentTaskId) {
      await this.maybeCreateTaskDriveFolder(saved, userId, groupId);
    }

    const reloaded =
      (await this.tasksRepository.findOne({
        where: { id: saved.id },
        relations: [...TASK_DETAIL_RELATIONS],
      })) ?? saved;
    await this.maybeNotifyGroupTaskAssigned(reloaded, userId);
    this.logger.log(
      `Task created: "${reloaded.title}" (id=${reloaded.id}) by user ${userId}`,
    );
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
    if (task.group_id) {
      await this.assertGroupNotLocked(task.group_id);
    }

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
    if (dto.expected_outcome_type !== undefined) {
      task.expected_outcome_type = dto.expected_outcome_type;
    }
    if (dto.expected_outcome_description !== undefined) {
      task.expected_outcome_description = dto.expected_outcome_description?.trim();
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
    this.logger.log(`Task ${id} updated by user ${userId}`);
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
    this.logger.log(`Task ${id} submitted for review by user ${userId}`);
    await this.maybeNotifyLeaderPendingReview(reloaded, userId);
    return reloaded;
  }

  async approveTask(
    id: string,
    leaderId: string,
    status: TaskStatus,
    comment?: string,
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
    this.logger.log(`Task ${id} ${status} by leader ${leaderId}`);
    await this.maybeNotifyAssigneeReviewResult(
      reloaded,
      group,
      status,
      comment,
    );
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
      if (group?.status === GroupStatus.LOCKED) {
        throw new ForbiddenException(
          'This group is locked and cannot be modified',
        );
      }
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
    this.logger.log(`Task ${id} deleted by user ${userId}`);
  }

  /**
   * Root tasks in pending_review status for all groups where the user is the leader.
   */
  async findPendingReviewTasksForLeader(userId: string): Promise<Task[]> {
    return this.tasksRepository
      .createQueryBuilder('t')
      .innerJoin('t.group', 'g', 'g.leader_id = :uid', { uid: userId })
      .leftJoinAndSelect('t.assignee', 'assignee')
      .leftJoinAndSelect('t.parent_task', 'parent_task')
      .leftJoinAndSelect('t.subtasks', 'subtasks')
      .leftJoinAndSelect('subtasks.assignee', 'subAssignee')
      .leftJoinAndSelect('subtasks.parent_task', 'subParent')
      .where('t.status = :status', { status: TaskStatus.PENDING_REVIEW })
      .andWhere('t.parent_task_id IS NULL')
      .orderBy('t.submitted_at', 'DESC')
      .getMany();
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

  // ---------------------------------------------------------------------------
  // Outcome links
  // ---------------------------------------------------------------------------

  async listOutcomeLinks(
    taskId: string,
    userId: string,
  ): Promise<TaskOutcomeLink[]> {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    await this.assertCanAccessTask(task, userId);
    return this.outcomeLinkRepository.find({
      where: { task_id: taskId },
      order: { created_at: 'ASC' },
    });
  }

  async addOutcomeLink(
    taskId: string,
    userId: string,
    dto: AddOutcomeLinkDto,
  ): Promise<TaskOutcomeLink> {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    this.assertIsAssignee(task, userId);
    const link = this.outcomeLinkRepository.create({
      task_id: taskId,
      url: dto.url,
      label: dto.label,
      created_by_id: userId,
    });
    return this.outcomeLinkRepository.save(link);
  }

  async removeOutcomeLink(
    taskId: string,
    linkId: string,
    userId: string,
  ): Promise<void> {
    const link = await this.outcomeLinkRepository.findOne({
      where: { id: linkId, task_id: taskId },
    });
    if (!link) throw new NotFoundException('Outcome link not found');
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (task) this.assertIsAssignee(task, userId);
    await this.outcomeLinkRepository.remove(link);
  }

  // ---------------------------------------------------------------------------
  // Outcome files (Google Drive)
  // ---------------------------------------------------------------------------

  async listOutcomeFiles(
    taskId: string,
    userId: string,
  ): Promise<DriveFileDto[]> {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    await this.assertCanAccessTask(task, userId);
    if (!task.drive_folder_id) return [];
    const accessToken = await this.resolveAccessToken(userId);
    if (!accessToken) return [];
    const files = await this.commonGoogleDriveService.listFiles(
      accessToken,
      task.drive_folder_id,
      100,
    );
    return (files ?? []).map(
      (f: {
        id?: string;
        name?: string;
        mimeType?: string;
        webViewLink?: string;
        modifiedTime?: string;
      }) => ({
        id: f.id ?? '',
        name: f.name ?? '',
        mimeType: f.mimeType ?? '',
        webViewLink: f.webViewLink,
        modifiedTime: f.modifiedTime,
      }),
    );
  }

  async uploadOutcomeFile(
    taskId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ id: string; name: string; webViewLink?: string }> {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    this.assertIsAssignee(task, userId);
    if (!task.drive_folder_id)
      throw new BadRequestException('This task has no Drive folder');
    const accessToken = await this.resolveAccessToken(userId);
    if (!accessToken)
      throw new ForbiddenException('Google Drive access required');
    const mime =
      file.mimetype && file.mimetype !== ''
        ? file.mimetype
        : 'application/octet-stream';
    const result = await this.commonGoogleDriveService.uploadFile(
      accessToken,
      file.originalname,
      file.buffer,
      mime,
      task.drive_folder_id,
    );
    return {
      id: result.id ?? '',
      name: result.name ?? file.originalname,
      webViewLink: result.webViewLink,
    };
  }

  async deleteOutcomeFile(
    taskId: string,
    userId: string,
    fileId: string,
  ): Promise<void> {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    this.assertIsAssignee(task, userId);
    if (!task.drive_folder_id)
      throw new BadRequestException('This task has no Drive folder');
    const accessToken = await this.resolveAccessToken(userId);
    if (!accessToken)
      throw new ForbiddenException('Google Drive access required');
    await this.commonGoogleDriveService.deleteFile(accessToken, fileId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers (new)
  // ---------------------------------------------------------------------------

  private assertIsAssignee(task: Task, userId: string): void {
    if (task.assignee_id !== userId) {
      throw new ForbiddenException(
        'Only the task assignee can manage outcome files and links',
      );
    }
  }

  private async resolveAccessToken(userId: string): Promise<string | null> {
    const user = await this.usersService.findById(userId, true);
    if (!user) return null;
    return this.googleAccessTokenService.resolveGoogleAccessToken(user);
  }

  private async maybeCreateTaskDriveFolder(
    task: Task,
    userId: string,
    groupId: string,
  ): Promise<void> {
    try {
      const group = await this.groupsRepository.findOne({
        where: { id: groupId },
        select: ['id', 'drive_folder_id'],
      });
      if (!group?.drive_folder_id) return;
      const accessToken = await this.resolveAccessToken(userId);
      if (!accessToken) return;
      const folder = await this.commonGoogleDriveService.createFolder(
        accessToken,
        `[Task] ${task.title}`,
        group.drive_folder_id,
      );
      if (folder?.id) {
        task.drive_folder_id = folder.id;
        await this.tasksRepository.save(task);
      }
    } catch (err) {
      this.logger.warn(
        `Could not create Drive folder for task ${task.id}: ${String(err)}`,
      );
    }
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
    if (
      !task.group_id ||
      !task.assignee_id ||
      task.assignee_id === actorUserId
    ) {
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
    if (
      !task.group_id ||
      !task.assignee_id ||
      task.assignee_id === editorUserId
    ) {
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
    const assigneeLang = assignee.preferred_language;
    const assigneeVi = assigneeLang !== 'en';
    await this.notificationsService.createNotification({
      recipient_id: assignee.id,
      type: NOTIFICATION_TYPE.TASK_ASSIGNED,
      message: assigneeVi
        ? `Bạn được giao "${task.title}" trong ${group.name}`
        : `You were assigned "${task.title}" in ${group.name}`,
      related_entity_type: RELATED_ENTITY_TYPE.TASK,
      related_entity_id: task.id,
    });
    if (assignee.notification_enabled) {
      const thread = await this.groupEmailThreadService.findByGroupAndUser(
        group.id,
        assignee.id,
      );
      await this.emailService.sendTaskAssignedEmail({
        toEmail: assignee.email,
        taskTitle: task.title,
        groupName: group.name,
        taskUrl,
        threadMessageId: thread?.thread_message_id,
        lang: assigneeLang,
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
    const leaderLang = leader.preferred_language;
    const leaderVi = leaderLang !== 'en';
    await this.notificationsService.createNotification({
      recipient_id: leader.id,
      type: NOTIFICATION_TYPE.TASK_PENDING_REVIEW,
      message: leaderVi
        ? `${submitterName} đã nộp "${task.title}" trong ${group.name} để duyệt`
        : `${submitterName} submitted "${task.title}" in ${group.name} for review`,
      related_entity_type: RELATED_ENTITY_TYPE.TASK,
      related_entity_id: task.id,
    });
    if (leader.notification_enabled) {
      const thread = await this.groupEmailThreadService.findByGroupAndUser(
        group.id,
        leader.id,
      );
      await this.emailService.sendTaskPendingReviewEmail({
        toEmail: leader.email,
        taskTitle: task.title,
        groupName: group.name,
        submitterName,
        taskUrl,
        threadMessageId: thread?.thread_message_id,
        lang: leaderLang,
      });
    }
  }

  private async maybeNotifyAssigneeReviewResult(
    task: Task,
    group: Group,
    status: TaskStatus,
    comment?: string,
  ): Promise<void> {
    if (!task.assignee_id) {
      return;
    }
    const assignee = await this.usersService.findOne(task.assignee_id);
    if (!assignee) {
      return;
    }
    const outcome = status === TaskStatus.DONE ? 'done' : 'failed';
    const assigneeLang2 = assignee.preferred_language;
    const assigneeVi2 = assigneeLang2 !== 'en';
    const label = assigneeVi2
      ? outcome === 'done'
        ? 'được duyệt (Hoàn thành)'
        : 'bị đánh dấu Thất bại'
      : outcome === 'done'
        ? 'approved (Done)'
        : 'marked as Failed';
    const rejectionReason =
      status === TaskStatus.FAILED && comment
        ? assigneeVi2
          ? ` Lý do: ${comment}`
          : ` Reason: ${comment}`
        : '';
    const taskUrl = this.groupTasksUrl(group.id);
    await this.notificationsService.createNotification({
      recipient_id: assignee.id,
      type: NOTIFICATION_TYPE.TASK_REVIEW_RESULT,
      message: assigneeVi2
        ? `Nhiệm vụ "${task.title}" của bạn trong ${group.name} đã ${label}.${rejectionReason}`
        : `Your task "${task.title}" in ${group.name} was ${label}.${rejectionReason}`,
      related_entity_type: RELATED_ENTITY_TYPE.TASK,
      related_entity_id: task.id,
    });
    if (assignee.notification_enabled) {
      const thread = await this.groupEmailThreadService.findByGroupAndUser(
        group.id,
        assignee.id,
      );
      await this.emailService.sendTaskReviewResultEmail({
        toEmail: assignee.email,
        taskTitle: task.title,
        groupName: group.name,
        outcome,
        comment: status === TaskStatus.FAILED ? comment : undefined,
        taskUrl,
        threadMessageId: thread?.thread_message_id,
        lang: assigneeLang2,
      });
    }
  }

  private async assertGroupNotLocked(groupId: string): Promise<void> {
    const group = await this.groupsRepository.findOne({
      where: { id: groupId },
      select: ['id', 'status'],
    });
    if (group?.status === GroupStatus.LOCKED) {
      throw new ForbiddenException(
        'This group is locked and cannot be modified',
      );
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
