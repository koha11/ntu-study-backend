import { describe, it, expect } from 'vitest';
import { Group } from './group.entity';
import { GroupMember } from './group-member.entity';
import { GroupInvitation } from './group-invitation.entity';

describe('Group Entities', () => {
  it('Group can be instantiated and properties assigned', () => {
    const entity = new Group();
    entity.name = 'Study Squad';
    entity.leader_id = 'user-1';
    expect(entity.name).toBe('Study Squad');
  });

  it('GroupMember can be instantiated and properties assigned', () => {
    const entity = new GroupMember();
    entity.group_id = 'group-1';
    entity.user_id = 'user-1';
    entity.is_active = true;
    expect(entity.is_active).toBe(true);
  });

  it('GroupInvitation can be instantiated and properties assigned', () => {
    const entity = new GroupInvitation();
    entity.group_id = 'group-1';
    entity.invitee_email = 'test@test.com';
    expect(entity.invitee_email).toBe('test@test.com');
  });
});
