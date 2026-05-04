import type { User } from '@modules/users/entities/user.entity';
import type { Task } from './entities/task.entity';

/** Public assignee payload for task APIs (no tokens or sensitive user fields). */
function publicAssignee(user: User | undefined | null): Record<string, unknown> | null {
  if (!user?.id) return null;
  return {
    id: user.id,
    full_name: user.full_name,
    avatar_url: user.avatar_url ?? null,
  };
}

function publicParent(parent: Task | undefined | null): Record<string, unknown> | null {
  if (!parent?.id) return null;
  return {
    id: parent.id,
    title: parent.title,
  };
}

/**
 * Maps a loaded `Task` entity to the JSON shape consumed by the frontend:
 * snake_case keys, nested `assignee` with `full_name` and `avatar_url`, shallow `parent_task`.
 */
export function serializeTaskForApi(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    created_at: task.created_at,
    updated_at: task.updated_at,
    title: task.title,
    description: task.description ?? null,
    group_id: task.group_id ?? null,
    parent_task_id: task.parent_task_id ?? null,
    created_by_id: task.created_by_id,
    assignee_id: task.assignee_id ?? null,
    status: task.status,
    due_date: task.due_date ?? null,
    submitted_at: task.submitted_at ?? null,
    reviewed_at: task.reviewed_at ?? null,
    reviewed_by_id: task.reviewed_by_id ?? null,
    assignee: publicAssignee(task.assignee as User | undefined),
    parent_task: publicParent(task.parent_task),
    subtasks: (task.subtasks ?? []).map(serializeTaskForApi),
  };
}
