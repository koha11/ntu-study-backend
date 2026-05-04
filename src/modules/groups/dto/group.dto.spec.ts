import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateGroupCalendarEventDto,
  CreateGroupDto,
  InviteMemberDto,
  ListGroupCalendarEventsQueryDto,
  UpdateGroupDto,
} from './group.dto';

describe('group.dto', () => {
  it('CreateGroupDto rejects empty name', async () => {
    const dto = plainToInstance(CreateGroupDto, { name: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('CreateGroupDto accepts optional report_date', async () => {
    const dto = plainToInstance(CreateGroupDto, {
      name: 'G',
      report_date: '2026-11-01',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('CreateGroupDto rejects invalid report_date when non-empty', async () => {
    const dto = plainToInstance(CreateGroupDto, {
      name: 'G',
      report_date: '01-11-2026',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'report_date')).toBe(true);
  });

  it('InviteMemberDto rejects invalid email', async () => {
    const dto = plainToInstance(InviteMemberDto, { email: 'not-an-email' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('UpdateGroupDto accepts empty object', async () => {
    const dto = plainToInstance(UpdateGroupDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('UpdateGroupDto accepts valid meet_link and report_date', async () => {
    const dto = plainToInstance(UpdateGroupDto, {
      meet_link: 'https://meet.google.com/abc-defg-hij',
      report_date: '2026-12-31',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('UpdateGroupDto accepts canva_file_url and doc_file_url', async () => {
    const dto = plainToInstance(UpdateGroupDto, {
      canva_file_url: 'https://www.canva.com/design/ABC/view',
      doc_file_url: 'https://docs.google.com/document/d/xyz/edit',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('UpdateGroupDto rejects invalid meet_link when non-empty', async () => {
    const dto = plainToInstance(UpdateGroupDto, {
      meet_link: 'not-a-url',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'meet_link')).toBe(true);
  });

  it('UpdateGroupDto rejects invalid report_date when non-empty', async () => {
    const dto = plainToInstance(UpdateGroupDto, {
      report_date: '31-12-2026',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'report_date')).toBe(true);
  });

  it('UpdateGroupDto accepts null meet_link and null report_date for clear', async () => {
    const dto = plainToInstance(UpdateGroupDto, {
      meet_link: null,
      report_date: null,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('UpdateGroupDto accepts empty meet_link and empty report_date without URL/date errors', async () => {
    const dto = plainToInstance(UpdateGroupDto, {
      meet_link: '',
      report_date: '',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('UpdateGroupDto accepts google_calendar_id and null to clear', async () => {
    const dto = plainToInstance(UpdateGroupDto, {
      google_calendar_id: 'abc123group.calendar.google.com',
    });
    expect(await validate(dto)).toHaveLength(0);

    const cleared = plainToInstance(UpdateGroupDto, {
      google_calendar_id: null,
    });
    expect(await validate(cleared)).toHaveLength(0);
  });

  it('ListGroupCalendarEventsQueryDto requires time_min and time_max', async () => {
    const ok = plainToInstance(ListGroupCalendarEventsQueryDto, {
      time_min: '2026-06-01T00:00:00.000Z',
      time_max: '2026-06-08T00:00:00.000Z',
    });
    expect(await validate(ok)).toHaveLength(0);
  });

  it('CreateGroupCalendarEventDto validates offline fields', async () => {
    const dto = plainToInstance(CreateGroupCalendarEventDto, {
      start: '2026-06-01T08:00:00.000Z',
      end: '2026-06-01T09:00:00.000Z',
      mode: 'offline',
      place_name: 'Hall A',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('CreateGroupCalendarEventDto validates online group_meet_link', async () => {
    const dto = plainToInstance(CreateGroupCalendarEventDto, {
      start: '2026-06-01T08:00:00.000Z',
      end: '2026-06-01T09:00:00.000Z',
      mode: 'online',
      online_option: 'group_meet_link',
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
