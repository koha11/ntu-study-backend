import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insertMock, listMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  listMock: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    calendar: vi.fn(() => ({
      events: {
        insert: insertMock,
        list: listMock,
      },
    })),
  },
}));

import { GoogleCalendarService } from './google-calendar.service';

describe('GoogleCalendarService', () => {
  let service: GoogleCalendarService;

  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockResolvedValue({
      data: {
        id: 'evt1',
        htmlLink: 'https://calendar.google.com/event?eid=x',
        conferenceData: {
          entryPoints: [
            {
              entryPointType: 'video',
              uri: 'https://meet.google.com/abc-defg-hij',
            },
          ],
        },
      },
    });
    listMock.mockResolvedValue({ data: { items: [] } });
    service = new GoogleCalendarService();
  });

  it('calls events.insert with Meet conferenceData and attendees', async () => {
    const result = await service.createEventWithMeetLink('access-token', {
      summary: 'Team sync',
      description: 'NTU Study',
      start: new Date('2026-06-01T08:00:00.000Z'),
      end: new Date('2026-06-01T09:00:00.000Z'),
      attendeeEmails: ['a@test.com', 'b@test.com'],
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    const callArg = insertMock.mock.calls[0][0] as {
      calendarId: string;
      conferenceDataVersion: number;
      sendUpdates: string;
      requestBody: Record<string, unknown>;
    };
    expect(callArg.calendarId).toBe('primary');
    expect(callArg.conferenceDataVersion).toBe(1);
    expect(callArg.sendUpdates).toBe('all');
    expect(callArg.requestBody.summary).toBe('Team sync');
    expect(callArg.requestBody.description).toBe('NTU Study');
    expect(callArg.requestBody.start).toEqual({
      dateTime: '2026-06-01T08:00:00.000Z',
    });
    expect(callArg.requestBody.end).toEqual({
      dateTime: '2026-06-01T09:00:00.000Z',
    });
    expect(callArg.requestBody.attendees).toEqual([
      { email: 'a@test.com' },
      { email: 'b@test.com' },
    ]);
    expect(
      (callArg.requestBody.conferenceData as { createRequest?: unknown })
        ?.createRequest,
    ).toMatchObject({
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    });
    expect(
      typeof (
        callArg.requestBody.conferenceData as {
          createRequest?: { requestId?: string };
        }
      )?.createRequest?.requestId,
    ).toBe('string');

    expect(result).toEqual({
      event_id: 'evt1',
      meet_link: 'https://meet.google.com/abc-defg-hij',
      html_link: 'https://calendar.google.com/event?eid=x',
      start: '2026-06-01T08:00:00.000Z',
      end: '2026-06-01T09:00:00.000Z',
    });
  });

  it('throws when Meet link is missing from API response', async () => {
    insertMock.mockResolvedValue({
      data: {
        id: 'evt2',
        htmlLink: 'https://calendar.google.com/event',
        conferenceData: {},
      },
    });

    await expect(
      service.createEventWithMeetLink('t', {
        summary: 'x',
        description: 'y',
        start: new Date(),
        end: new Date(),
        attendeeEmails: ['a@test.com'],
      }),
    ).rejects.toThrow(/meet link/i);
  });

  describe('listEventsInRange', () => {
    it('calls events.list with expanded single events and maps fields', async () => {
      listMock.mockResolvedValue({
        data: {
          items: [
            {
              id: 'e1',
              summary: 'Standup',
              htmlLink: 'https://calendar.google.com/event?eid=a',
              start: { dateTime: '2026-06-02T10:00:00.000Z' },
              end: { dateTime: '2026-06-02T10:30:00.000Z' },
              hangoutLink: 'https://meet.google.com/zzz',
            },
            {
              id: 'e2',
              summary: 'All day',
              htmlLink: 'https://calendar.google.com/event?eid=b',
              start: { date: '2026-06-03' },
              end: { date: '2026-06-04' },
            },
          ],
        },
      });

      const min = new Date('2026-06-01T00:00:00.000Z');
      const max = new Date('2026-06-07T00:00:00.000Z');
      const rows = await service.listEventsInRange('tok', 'cal@group.calendar.google.com', min, max);

      expect(listMock).toHaveBeenCalledWith({
        calendarId: 'cal@group.calendar.google.com',
        timeMin: min.toISOString(),
        timeMax: max.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500,
      });

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        id: 'e1',
        summary: 'Standup',
        html_link: 'https://calendar.google.com/event?eid=a',
        meet_link: 'https://meet.google.com/zzz',
      });
      expect(rows[1].start.date).toBe('2026-06-03');
    });
  });

  describe('createGroupCalendarEvent', () => {
    it('offline: sets location from place and appends map URL to description', async () => {
      insertMock.mockResolvedValue({
        data: {
          id: 'off1',
          htmlLink: 'https://calendar.google.com/event?x',
        },
      });

      const result = await service.createGroupCalendarEvent('tok', {
        calendarId: 'shared@group.calendar.google.com',
        summary: 'Lab',
        description: 'From NTU Study',
        start: new Date('2026-07-01T12:00:00.000Z'),
        end: new Date('2026-07-01T14:00:00.000Z'),
        attendeeEmails: ['m@test.com'],
        mode: 'offline',
        place_name: 'Library',
        address_detail: 'Level 3',
        maps_url: 'https://maps.google.com/?q=NTU',
      });

      const callArg = insertMock.mock.calls[0][0] as {
        calendarId: string;
        conferenceDataVersion: number;
        requestBody: Record<string, unknown>;
      };
      expect(callArg.calendarId).toBe('shared@group.calendar.google.com');
      expect(callArg.conferenceDataVersion).toBe(0);
      expect(callArg.requestBody.location).toBe('Library — Level 3');
      expect(callArg.requestBody.description).toContain('Map: https://maps.google.com/?q=NTU');
      expect(result.meet_link).toBeNull();
      expect(result.event_id).toBe('off1');
    });

    it('online group_meet_link: uses static URL as location, no conferenceData', async () => {
      insertMock.mockResolvedValue({
        data: { id: 'g1', htmlLink: 'https://calendar.google.com/h' },
      });

      const result = await service.createGroupCalendarEvent('tok', {
        calendarId: 'shared@group.calendar.google.com',
        summary: 'Sync',
        description: 'desc',
        start: new Date('2026-07-02T08:00:00.000Z'),
        end: new Date('2026-07-02T09:00:00.000Z'),
        attendeeEmails: ['a@test.com'],
        mode: 'online',
        online_option: 'group_meet_link',
        static_meet_url: 'https://meet.google.com/aaa-bbbb-ccc',
      });

      const callArg = insertMock.mock.calls[0][0] as {
        conferenceDataVersion: number;
        requestBody: Record<string, unknown>;
      };
      expect(callArg.conferenceDataVersion).toBe(0);
      expect(callArg.requestBody.location).toBe('https://meet.google.com/aaa-bbbb-ccc');
      expect(callArg.requestBody.conferenceData).toBeUndefined();
      expect(result.meet_link).toBe('https://meet.google.com/aaa-bbbb-ccc');
    });

    it('online one_time_meet: creates conference Meet', async () => {
      insertMock.mockResolvedValue({
        data: {
          id: 'ot1',
          htmlLink: 'https://calendar.google.com/y',
          conferenceData: {
            entryPoints: [
              { entryPointType: 'video', uri: 'https://meet.google.com/new-new-new' },
            ],
          },
        },
      });

      const result = await service.createGroupCalendarEvent('tok', {
        calendarId: 'shared@group.calendar.google.com',
        summary: 'Once',
        description: 'd',
        start: new Date('2026-07-03T10:00:00.000Z'),
        end: new Date('2026-07-03T11:00:00.000Z'),
        attendeeEmails: ['b@test.com'],
        mode: 'online',
        online_option: 'one_time_meet',
      });

      const callArg = insertMock.mock.calls[0][0] as {
        conferenceDataVersion: number;
        requestBody: Record<string, unknown>;
      };
      expect(callArg.conferenceDataVersion).toBe(1);
      expect(
        (callArg.requestBody.conferenceData as { createRequest?: unknown })?.createRequest,
      ).toBeDefined();
      expect(result.meet_link).toBe('https://meet.google.com/new-new-new');
    });
  });
});
