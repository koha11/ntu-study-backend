import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EmailService } from './email.service';
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
        {
          due_date: LessThan(now),
          status: TaskStatus.TODO,
        },
        {
          due_date: LessThan(now),
          status: TaskStatus.IN_PROGRESS,
        },
      ],
      relations: ['assignee'],
    });

    if (overdueTasks.length === 0) {
      this.logger.log('No overdue tasks found');
      return;
    }

    this.logger.log(`Found ${overdueTasks.length} overdue tasks`);

    const tasksByUser = new Map<string, Task[]>();
    for (const task of overdueTasks) {
      if (task.assignee) {
        const userId = task.assignee.id;
        if (!tasksByUser.has(userId)) {
          tasksByUser.set(userId, []);
        }
        tasksByUser.get(userId)!.push(task);
      }
    }

    for (const [userId, tasks] of tasksByUser.entries()) {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        continue;
      }

      const hasEmailNotification = user.notification_enabled !== false;

      if (hasEmailNotification) {
        for (const task of tasks) {
          if (task.due_date) {
            await this.emailService.sendTaskReminder(
              user.email,
              task.title,
              task.due_date,
            );
          }
        }
      }

      for (const task of tasks) {
        const notification = new Notification();
        notification.recipient = user;
        notification.recipient_id = user.id;
        notification.type = `Task Overdue`;
        notification.message = `Your task "${task.title}" is overdue${
          task.due_date ? ` (due ${task.due_date.toLocaleDateString()})` : ''
        }`;
        notification.is_read = false;
        notification.delivery_channel = NotificationDeliveryChannel.WEB;

        await this.notificationsRepository.save(notification);
      }
    }

    this.logger.log(`Sent overdue reminders to ${tasksByUser.size} users`);
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
