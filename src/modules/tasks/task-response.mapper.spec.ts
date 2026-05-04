import { describe, it, expect } from 'vitest';
import { TaskStatus } from '@common/enums';
import { serializeTaskForApi } from './task-response.mapper';
import type { Task } from './entities/task.entity';
import type { User } from '@modules/users/entities/user.entity';

describe('serializeTaskForApi', () => {
  it('includes safe assignee with full_name and avatar_url', () => {
    const assignee = {
      id: 'u1',
      full_name: 'Alex Example',
      avatar_url: 'https://example.com/a.png',
    } as User;

    const task = {
      id: 't1',
      created_at: new Date('2025-01-01'),
      updated_at: new Date('2025-01-02'),
      title: 'Do work',
      description: null,
      group_id: 'g1',
      parent_task_id: null,
      created_by_id: 'u0',
      assignee_id: 'u1',
      status: TaskStatus.TODO,
      due_date: null,
      submitted_at: null,
      reviewed_at: null,
      reviewed_by_id: null,
      assignee,
      parent_task: null,
      subtasks: [],
    } as Task;

    const json = serializeTaskForApi(task);
    expect(json.assignee).toEqual({
      id: 'u1',
      full_name: 'Alex Example',
      avatar_url: 'https://example.com/a.png',
    });
    expect(json).not.toHaveProperty('google_access_token');
  });

  it('maps subtasks recursively with assignee', () => {
    const subAssignee = {
      id: 'u2',
      full_name: 'Sub Owner',
      avatar_url: null,
    } as User;

    const parentRef = {
      id: 'p1',
      title: 'Parent title',
    } as Task;

    const sub = {
      id: 's1',
      created_at: new Date(),
      updated_at: new Date(),
      title: 'Sub',
      group_id: 'g1',
      parent_task_id: 'p1',
      created_by_id: 'u0',
      assignee_id: 'u2',
      status: TaskStatus.IN_PROGRESS,
      assignee: subAssignee,
      parent_task: parentRef,
      subtasks: [],
    } as Task;

    const root = {
      id: 'p1',
      created_at: new Date(),
      updated_at: new Date(),
      title: 'Parent title',
      group_id: 'g1',
      created_by_id: 'u0',
      assignee_id: 'u1',
      status: TaskStatus.TODO,
      assignee: null,
      parent_task: null,
      subtasks: [sub],
    } as Task;

    const json = serializeTaskForApi(root);
    const subs = json.subtasks as Record<string, unknown>[];
    expect(subs).toHaveLength(1);
    expect(subs[0]!.assignee).toEqual({
      id: 'u2',
      full_name: 'Sub Owner',
      avatar_url: null,
    });
    expect(subs[0]!.parent_task).toEqual({ id: 'p1', title: 'Parent title' });
  });
});
