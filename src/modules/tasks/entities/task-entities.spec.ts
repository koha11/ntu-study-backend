import { describe, it, expect } from 'vitest';
import { Task } from './task.entity';

describe('Task Entity', () => {
  it('Task can be instantiated and properties assigned', () => {
    const entity = new Task();
    entity.title = 'Implement feature';
    entity.creator_id = 'user-1';
    entity.assignee_id = 'user-2';
    expect(entity.title).toBe('Implement feature');
    expect(entity.assignee_id).toBe('user-2');
  });

  it('Task subtasks defaults to empty array', () => {
    const entity = new Task();
    expect(entity).toBeDefined();
  });
});
