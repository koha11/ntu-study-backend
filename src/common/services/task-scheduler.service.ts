import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EmailService } from './email.service';
import { Task } from '../../modules/tasks/entities/task.entity';
import { TaskStatus } from '../enums/task-status.enum';
import { User } from '../../modules/users/entities/user.entity';
import { Notification } from '../../modules/notifications/entities/notification.entity';
import { NotificationDeliveryChannel } from '../enums/notification-delivery-channel.enum';

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
    private emailService: EmailService,
  ) {}

  /**
   * Cron job to check for overdue tasks and send reminders
   * Runs daily at 9:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendOverdueTaskReminders() {
    this.logger.log('Starting overdue task reminder job...');

    try {
      const now = new Date();

      // Find all overdue tasks that are not completed
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

      // Group tasks by assigned user
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

      // Send reminders to each user
      for (const [userId, tasks] of tasksByUser.entries()) {
        const user = await this.usersRepository.findOne({
          where: { id: userId },
        });

        if (!user) {
          continue;
        }

        // Check if user has notification enabled
        const hasEmailNotification = user.notification_enabled !== false;

        if (hasEmailNotification) {
          // Send email reminder
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

        // Create in-app notifications
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Overdue task reminder job failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Cron job to cleanup old notifications
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldNotifications() {
    this.logger.log('Starting notification cleanup job...');

    try {
      // Keep notifications for 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.notificationsRepository.delete({
        created_at: LessThan(thirtyDaysAgo),
        is_read: true,
      });

      this.logger.log(`Cleaned up ${result.affected || 0} old notifications`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Notification cleanup job failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
