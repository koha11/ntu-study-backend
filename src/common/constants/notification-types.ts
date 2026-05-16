/** In-app notification `type` values stored on Notification.type */
export const NOTIFICATION_TYPE = {
  GROUP_INVITATION: 'group_invitation',
  TASK_ASSIGNED: 'task_assigned',
  TASK_PENDING_REVIEW: 'task_pending_review',
  TASK_REVIEW_RESULT: 'task_review_result',
  EVALUATION_CLOSED: 'evaluation_closed',
} as const;

export type NotificationTypeValue =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

/** Values for Notification.related_entity_type */
export const RELATED_ENTITY_TYPE = {
  GROUP_INVITATION: 'group_invitation',
  TASK: 'task',
  CONTRIBUTION_EVALUATION: 'contribution_evaluation',
} as const;
