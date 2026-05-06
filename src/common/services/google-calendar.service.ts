import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface CreateMeetEventParams {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  attendeeEmails: string[];
}

export interface CreateMeetEventResult {
  event_id: string;
  meet_link: string;
  html_link: string;
  start: string;
  end: string;
}

/** Normalized event for week/day grid */
export interface ListedCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string | null; date?: string | null };
  end: { dateTime?: string | null; date?: string | null };
  html_link: string;
  location?: string | null;
  meet_link?: string | null;
}

export interface CreateGroupCalendarEventParams {
  calendarId: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  attendeeEmails: string[];
  mode: 'offline' | 'online';
  place_name?: string;
  address_detail?: string;
  maps_url?: string;
  online_option?: 'group_meet_link' | 'one_time_meet';
  /** Required when online_option is group_meet_link */
  static_meet_url?: string;
}

export interface CreateGroupCalendarEventResult {
  event_id: string;
  html_link: string;
  start: string;
  end: string;
  meet_link: string | null;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  private getCalendarClient(accessToken: string): calendar_v3.Calendar {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Creates a secondary (group) calendar under the signed-in Google account.
   * Returns the calendar `id` used as `google_calendar_id`, or null on failure.
   */
  async createSecondaryCalendar(
    accessToken: string,
    summary: string,
    description?: string,
  ): Promise<string | null> {
    const title = summary.trim();
    if (!title) {
      return null;
    }
    try {
      const calendar = this.getCalendarClient(accessToken);
      const { data } = await calendar.calendars.insert({
        requestBody: {
          summary: title,
          ...(description?.trim()
            ? { description: description.trim() }
            : {}),
        },
      });
      const id = data.id?.trim();
      return id || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to create secondary calendar: ${message}`);
      return null;
    }
  }

  /**
   * Lists events in a calendar within [timeMin, timeMax).
   */
  async listEventsInRange(
    accessToken: string,
    calendarId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<ListedCalendarEvent[]> {
    const calendar = this.getCalendarClient(accessToken);
    const { data } = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
    });

    const items = data.items ?? [];
    return items.map((ev) => this.mapListedEvent(ev));
  }

  private mapListedEvent(ev: calendar_v3.Schema$Event): ListedCalendarEvent {
    const meetFromConference = this.extractMeetLink(ev);
    const meet_link =
      ev.hangoutLink?.trim() ||
      meetFromConference ||
      (typeof ev.location === 'string' && ev.location.includes('meet.google.com')
        ? ev.location
        : null);

    return {
      id: ev.id ?? '',
      summary: ev.summary ?? '(No title)',
      start: {
        dateTime: ev.start?.dateTime ?? undefined,
        date: ev.start?.date ?? undefined,
      },
      end: {
        dateTime: ev.end?.dateTime ?? undefined,
        date: ev.end?.date ?? undefined,
      },
      html_link: ev.htmlLink ?? '',
      location: ev.location ?? null,
      meet_link,
    };
  }

  /**
   * Creates an event on a specific calendar (offline location, static Meet URL, or new Meet).
   */
  async createGroupCalendarEvent(
    accessToken: string,
    params: CreateGroupCalendarEventParams,
  ): Promise<CreateGroupCalendarEventResult> {
    const {
      calendarId,
      summary,
      description,
      start,
      end,
      attendeeEmails,
      mode,
    } = params;

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const attendees = attendeeEmails.map((email) => ({ email }));

    let requestBody: calendar_v3.Schema$Event;
    let conferenceDataVersion = 0;

    if (mode === 'offline') {
      const place = params.place_name?.trim() ?? '';
      const detail = params.address_detail?.trim();
      const location =
        detail && place ? `${place} — ${detail}` : place || detail || undefined;

      let fullDescription = description;
      if (params.maps_url?.trim()) {
        fullDescription = `${fullDescription}\n\nMap: ${params.maps_url.trim()}`;
      }

      requestBody = {
        summary,
        description: fullDescription,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
        attendees,
        ...(location ? { location } : {}),
      };
    } else if (params.online_option === 'group_meet_link') {
      const url = params.static_meet_url?.trim();
      if (!url) {
        throw new Error('Missing Meet URL for group_meet_link');
      }
      requestBody = {
        summary,
        description,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
        attendees,
        location: url,
      };
    } else if (params.online_option === 'one_time_meet') {
      conferenceDataVersion = 1;
      requestBody = {
        summary,
        description,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      };
    } else {
      throw new Error('Invalid online calendar event parameters');
    }

    const calendar = this.getCalendarClient(accessToken);
    const { data } = await calendar.events.insert({
      calendarId,
      conferenceDataVersion,
      sendUpdates: 'all',
      requestBody,
    });

    let meet_link: string | null = null;
    if (mode === 'online' && params.online_option === 'group_meet_link') {
      meet_link = params.static_meet_url?.trim() ?? null;
    } else if (mode === 'online' && params.online_option === 'one_time_meet') {
      meet_link = this.extractMeetLink(data);
      if (!meet_link) {
        this.logger.error('Calendar event created but no Meet link in response');
        throw new Error(
          'Could not create a Google Meet link. Try signing out and signing in again to grant Calendar access.',
        );
      }
    }

    return {
      event_id: data.id ?? '',
      html_link: data.htmlLink ?? '',
      start: startIso,
      end: endIso,
      meet_link,
    };
  }

  /**
   * Creates a primary-calendar event with a Google Meet link and invites attendees.
   */
  async createEventWithMeetLink(
    accessToken: string,
    params: CreateMeetEventParams,
  ): Promise<CreateMeetEventResult> {
    const { summary, description, start, end, attendeeEmails } = params;
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const requestBody: calendar_v3.Schema$Event = {
      summary,
      description,
      start: { dateTime: startIso },
      end: { dateTime: endIso },
      attendees: attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const calendar = this.getCalendarClient(accessToken);
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody,
    });

    const meetLink = this.extractMeetLink(data);
    if (!meetLink) {
      this.logger.error('Calendar event created but no Meet link in response');
      throw new Error(
        'Could not create a Google Meet link. Try signing out and signing in again to grant Calendar access.',
      );
    }

    return {
      event_id: data.id ?? '',
      meet_link: meetLink,
      html_link: data.htmlLink ?? '',
      start: startIso,
      end: endIso,
    };
  }

  private extractMeetLink(data: calendar_v3.Schema$Event | null | undefined): string | null {
    if (!data?.conferenceData?.entryPoints) {
      return null;
    }
    for (const ep of data.conferenceData.entryPoints) {
      if (ep.entryPointType === 'video' && ep.uri?.includes('meet.google.com')) {
        return ep.uri;
      }
    }
    const anyVideo = data.conferenceData.entryPoints.find(
      (e) => e.entryPointType === 'video' && e.uri,
    );
    return anyVideo?.uri ?? null;
  }
}
