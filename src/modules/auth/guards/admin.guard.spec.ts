import { ForbiddenException } from '@nestjs/common';
import { describe, it, expect } from 'vitest';
import { AdminGuard } from './admin.guard';
import { UserRole } from '@common/enums';

function mockCtx(user: { role?: UserRole }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as Parameters<AdminGuard['canActivate']>[0];
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('allows when role is admin', () => {
    expect(
      guard.canActivate(mockCtx({ role: UserRole.ADMIN })),
    ).toBe(true);
  });

  it('throws when role is not admin', () => {
    expect(() =>
      guard.canActivate(mockCtx({ role: UserRole.USER })),
    ).toThrow(ForbiddenException);
  });

  it('throws when user missing', () => {
    expect(() => guard.canActivate(mockCtx({}))).toThrow(ForbiddenException);
  });
});
