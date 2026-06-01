import { describe, it, expect } from 'vitest';
import { User } from './user.entity';
import { Role } from './role.entity';

describe('User Entities', () => {
  it('User can be instantiated and properties assigned', () => {
    const entity = new User();
    entity.email = 'test@test.com';
    entity.full_name = 'Test User';
    entity.is_active = true;
    entity.notification_enabled = true;
    expect(entity.email).toBe('test@test.com');
    expect(entity.is_active).toBe(true);
  });

  it('Role can be instantiated and properties assigned', () => {
    const entity = new Role();
    entity.role_name = 'user';
    expect(entity.role_name).toBe('user');
  });
});
