import { describe, it, expect } from 'vitest';
import { Notification } from './notification.entity';

describe('Notification Entity', () => {
  it('Notification can be instantiated and properties assigned', () => {
    const entity = new Notification();
    entity.recipient_id = 'user-1';
    entity.type = 'Task Overdue';
    entity.message = 'Your task is overdue';
    entity.is_read = false;
    expect(entity.type).toBe('Task Overdue');
    expect(entity.is_read).toBe(false);
  });
});
