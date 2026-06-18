import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Between, Not, In, IsNull } from 'typeorm';
import { EmailService } from './email.service';
import { GroupEmailThreadService } from './group-email-thread.service';
import { Task } from '../../modules/tasks/entities/task.entity';
import { TaskStatus } from '../enums/task-status.enum';
import { User } from '../../modules/users/entities/user.entity';
import { Notification } from '../../modules/notifications/entities/notification.entity';
import { NotificationDeliveryChannel } from '../enums/notification-delivery-channel.enum';
import { CronJobRun } from '../../modules/cron-jobs/entities/cron-job-run.entity';
import { CronJobRunStatus, CronJobTrigger } from '../enums';
import { CRON_JOB_NAMES } from '../constants/cron-job-names';

@Injectable()
export class TaskSchedulerService {
  private readonly logger = new Logger(TaskSchedulerService.name);

  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(CronJobRun)
    private cronJobRunsRepository: Repository<CronJobRun>,
    private emailService: EmailService,
    private groupEmailThreadService: GroupEmailThreadService,
  ) {}

  private async recordJobRun(
    jobName: string,
    triggeredBy: CronJobTrigger,
    fn: () => Promise<void>,
  ): Promise<void> {
    const run = this.cronJobRunsRepository.create({
      job_name: jobName,
      started_at: new Date(),
      finished_at: null,
      status: CronJobRunStatus.RUNNING,
      error_message: null,
      triggered_by: triggeredBy,
    });
    await this.cronJobRunsRepository.save(run);

    try {
      await fn();
      run.status = CronJobRunStatus.SUCCESS;
      run.finished_at = new Date();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `${jobName} failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      run.status = CronJobRunStatus.FAILURE;
      run.error_message =
        errorMessage.length > 8000
          ? `${errorMessage.slice(0, 8000)}…`
          : errorMessage;
      run.finished_at = new Date();
    }

    await this.cronJobRunsRepository.save(run);
  }

  /**
   * Cron job to check for overdue tasks and send reminders
   * Runs daily at 9:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendOverdueTaskReminders() {
    this.logger.log('Starting overdue task reminder job...');
    await this.recordJobRun(
      CRON_JOB_NAMES.OVERDUE_TASK_REMINDERS,
      CronJobTrigger.CRON,
      () => this.executeOverdueTaskReminders(),
    );
  }

  private async executeOverdueTaskReminders(): Promise<void> {
    const now = new Date();

    const overdueTasks = await this.tasksRepository.find({
      where: [
        { due_date: LessThan(now), status: TaskStatus.TODO },
        { due_date: LessThan(now), status: TaskStatus.IN_PROGRESS },
      ],
      relations: ['assignee', 'group'],
    });

    if (overdueTasks.length === 0) {
      this.logger.log('No overdue tasks found');
      return;
    }

    this.logger.log(`Found ${overdueTasks.length} overdue tasks`);

    // Group by userId → groupKey ('personal' or groupId) → tasks
    const byUserAndGroup = new Map<string, Map<string, Task[]>>();
    for (const task of overdueTasks) {
      if (!task.assignee) continue;
      const uid = task.assignee.id;
      const gkey = task.group_id ?? 'personal';
      if (!byUserAndGroup.has(uid)) byUserAndGroup.set(uid, new Map());
      const byGroup = byUserAndGroup.get(uid)!;
      if (!byGroup.has(gkey)) byGroup.set(gkey, []);
      byGroup.get(gkey)!.push(task);
    }

    const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    );

    for (const [userId, byGroup] of byUserAndGroup.entries()) {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });
      if (!user) continue;

      for (const [groupKey, tasks] of byGroup.entries()) {
        // Always create in-app notifications regardless of email preference
        const userVi = user.preferred_language !== 'en';
        for (const task of tasks) {
          const notification = new Notification();
          notification.recipient = user;
          notification.recipient_id = user.id;
          notification.type = 'Task Overdue';
          notification.message = userVi
            ? `Nhiệm vụ "${task.title}" của bạn đã quá hạn${
                task.due_date
                  ? ` (hạn ${task.due_date.toLocaleDateString()})`
                  : ''
              }`
            : `Your task "${task.title}" is overdue${
                task.due_date
                  ? ` (due ${task.due_date.toLocaleDateString()})`
                  : ''
              }`;
          notification.is_read = false;
          notification.delivery_channel = NotificationDeliveryChannel.WEB;
          await this.notificationsRepository.save(notification);
        }

        if (user.notification_enabled === false) continue;

        const taskItems = tasks
          .filter((t) => t.due_date)
          .map((t) => ({ title: t.title, dueDate: t.due_date! }));
        if (taskItems.length === 0) continue;

        if (groupKey === 'personal') {
          // Personal tasks: send one batched email with no threading
          await this.emailService.sendBatchedTaskReminderEmail({
            toEmail: user.email,
            groupName: userVi ? 'Nhiệm vụ cá nhân' : 'Personal Tasks',
            tasks: taskItems,
            groupUrl: `${base}/tasks`,
            lang: user.preferred_language,
          });
        } else {
          const groupName = tasks[0].group?.name ?? groupKey;
          const thread = await this.groupEmailThreadService.findByGroupAndUser(
            groupKey,
            userId,
          );
          await this.emailService.sendBatchedTaskReminderEmail({
            toEmail: user.email,
            groupName,
            tasks: taskItems,
            groupUrl: `${base}/groups/${groupKey}`,
            threadMessageId: thread?.thread_message_id,
            lang: user.preferred_language,
          });
        }
      }
    }

    this.logger.log(`Sent overdue reminders to ${byUserAndGroup.size} users`);
  }

  /**
   * Cron job to remind group leaders of member tasks due within 2 days.
   * Runs daily at 9:00 AM — covers tasks due today, tomorrow, or the day after.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendUpcomingDueTaskReminders() {
    this.logger.log('Starting upcoming due task reminder job...');
    await this.recordJobRun(
      CRON_JOB_NAMES.UPCOMING_DUE_TASK_REMINDERS,
      CronJobTrigger.CRON,
      () => this.executeUpcomingDueTaskReminders(),
    );
  }

  private async executeUpcomingDueTaskReminders(): Promise<void> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endInclusive = new Date(startOfToday);
    endInclusive.setDate(endInclusive.getDate() + 2);
    endInclusive.setHours(23, 59, 59, 999);

    const upcomingTasks = await this.tasksRepository.find({
      where: {
        due_date: Between(startOfToday, endInclusive),
        status: Not(In([TaskStatus.DONE, TaskStatus.FAILED])),
        group_id: Not(IsNull()),
        assignee_id: Not(IsNull()),
      },
      relations: ['assignee', 'group', 'group.leader'],
    });

    if (upcomingTasks.length === 0) {
      this.logger.log('No upcoming group tasks found');
      return;
    }

    this.logger.log(`Found ${upcomingTasks.length} upcoming group tasks`);

    // Group by group_id, skipping tasks with no group or no leader
    const byGroup = new Map<string, typeof upcomingTasks>();
    for (const task of upcomingTasks) {
      if (!task.group || !task.group.leader) continue;
      const gid = task.group_id!;
      if (!byGroup.has(gid)) byGroup.set(gid, []);
      byGroup.get(gid)!.push(task);
    }

    const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    );

    for (const [groupId, tasks] of byGroup.entries()) {
      const group = tasks[0].group!;
      const leader = group.leader;

      const leaderVi = leader.preferred_language !== 'en';

      const notification = new Notification();
      notification.recipient = leader;
      notification.recipient_id = leader.id;
      notification.type = 'Task Due Soon';
      notification.message = leaderVi
        ? `${tasks.length} nhiệm vụ trong nhóm "${group.name}" sắp đến hạn`
        : `${tasks.length} task(s) in "${group.name}" are due soon`;
      notification.is_read = false;
      notification.delivery_channel = NotificationDeliveryChannel.WEB;
      await this.notificationsRepository.save(notification);

      if (leader.notification_enabled === false) continue;

      const taskItems = tasks
        .filter((t) => t.due_date)
        .map((t) => ({
          title: t.title,
          assigneeName: t.assignee?.full_name ?? 'Unknown',
          dueDate: t.due_date!,
        }));
      if (taskItems.length === 0) continue;

      const thread = await this.groupEmailThreadService.findByGroupAndUser(
        groupId,
        leader.id,
      );
      await this.emailService.sendUpcomingDueTaskReminderToLeaderEmail({
        toEmail: leader.email,
        groupName: group.name,
        tasks: taskItems,
        groupUrl: `${base}/groups/${groupId}`,
        threadMessageId: thread?.thread_message_id,
        lang: leader.preferred_language,
      });
    }

    this.logger.log(
      `Sent upcoming due task reminders for ${byGroup.size} groups`,
    );
  }

  /**
   * Cron job to cleanup old notifications
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldNotifications() {
    this.logger.log('Starting notification cleanup job...');
    await this.recordJobRun(
      CRON_JOB_NAMES.CLEANUP_OLD_NOTIFICATIONS,
      CronJobTrigger.CRON,
      () => this.executeCleanupOldNotifications(),
    );
  }

  private async executeCleanupOldNotifications(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.notificationsRepository.delete({
      created_at: LessThan(thirtyDaysAgo),
      is_read: true,
    });

    this.logger.log(`Cleaned up ${result.affected || 0} old notifications`);
  }

  /** Admin-only manual trigger by slug (see CRON_JOB_NAMES). */
  async runJobBySlug(slug: string): Promise<void> {
    switch (slug) {
      case CRON_JOB_NAMES.OVERDUE_TASK_REMINDERS:
        return this.recordJobRun(
          CRON_JOB_NAMES.OVERDUE_TASK_REMINDERS,
          CronJobTrigger.MANUAL,
          () => this.executeOverdueTaskReminders(),
        );
      case CRON_JOB_NAMES.UPCOMING_DUE_TASK_REMINDERS:
        return this.recordJobRun(
          CRON_JOB_NAMES.UPCOMING_DUE_TASK_REMINDERS,
          CronJobTrigger.MANUAL,
          () => this.executeUpcomingDueTaskReminders(),
        );
      case CRON_JOB_NAMES.CLEANUP_OLD_NOTIFICATIONS:
        return this.recordJobRun(
          CRON_JOB_NAMES.CLEANUP_OLD_NOTIFICATIONS,
          CronJobTrigger.MANUAL,
          () => this.executeCleanupOldNotifications(),
        );
      default:
        throw new NotFoundException(`Unknown cron job: ${slug}`);
    }
  }
}
