import { validate } from 'class-validator';
import { describe, it, expect } from 'vitest';
import { UpdateUserDto } from './user.dto';

describe('UpdateUserDto', () => {
  it('accepts a valid numeric string for drive_total_quota (triggers ValidateIf callback)', async () => {
    const dto = Object.assign(new UpdateUserDto(), { drive_total_quota: '1073741824' });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'drive_total_quota')).toHaveLength(0);
  });

  it('rejects non-numeric drive_total_quota when ValidateIf passes', async () => {
    const dto = Object.assign(new UpdateUserDto(), { drive_total_quota: 'not-a-number' });
    const errors = await validate(dto);
    const quotaErrors = errors.filter((e) => e.property === 'drive_total_quota');
    expect(quotaErrors.length).toBeGreaterThan(0);
  });

  it('skips drive_total_quota validation when null (ValidateIf returns false)', async () => {
    const dto = Object.assign(new UpdateUserDto(), { drive_total_quota: null });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'drive_total_quota')).toHaveLength(0);
  });
});
