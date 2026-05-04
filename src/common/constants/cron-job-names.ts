/** URL-safe slugs for admin manual run + persisted `cron_job_runs.job_name`. */
export const CRON_JOB_NAMES = {
  OVERDUE_TASK_REMINDERS: 'overdue-task-reminders',
  CLEANUP_OLD_NOTIFICATIONS: 'notification-cleanup',
} as const;

export type CronJobName =
  (typeof CRON_JOB_NAMES)[keyof typeof CRON_JOB_NAMES];
