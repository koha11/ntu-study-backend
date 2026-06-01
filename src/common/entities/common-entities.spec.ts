import { describe, it, expect } from 'vitest';
import { GroupEmailThread } from './group-email-thread.entity';

describe('Common Entities', () => {
  it('GroupEmailThread can be instantiated and properties assigned', () => {
    const entity = new GroupEmailThread();
    entity.group_id = 'group-1';
    entity.user_id = 'user-1';
    entity.thread_message_id = '<root@ntu-study.local>';
    expect(entity.thread_message_id).toBe('<root@ntu-study.local>');
  });
});
