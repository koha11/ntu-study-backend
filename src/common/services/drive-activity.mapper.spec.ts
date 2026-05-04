import { describe, it, expect } from 'vitest';
import type { driveactivity_v2 } from 'googleapis';
import {
  mapDriveActivityToEntry,
  mapDriveActivities,
} from './drive-activity.mapper';

describe('drive-activity.mapper', () => {
  it('maps create action and drive item target', () => {
    const activity: driveactivity_v2.Schema$DriveActivity = {
      timestamp: '2024-01-15T12:00:00.000Z',
      primaryActionDetail: {
        create: {},
      },
      actors: [
        {
          user: {
            knownUser: { personName: 'people/abc123', isCurrentUser: true },
          },
        },
      ],
      targets: [
        {
          driveItem: {
            name: 'items/file-id-1',
            title: 'Notes.docx',
            mimeType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        },
      ],
    };

    expect(mapDriveActivityToEntry(activity)).toEqual({
      occurredAt: '2024-01-15T12:00:00.000Z',
      actorLabel: 'abc123',
      actorPersonResource: 'people/abc123',
      fileName: 'Notes.docx',
      fileId: 'file-id-1',
      action: 'Created',
    });
  });

  it('uses timeRange when timestamp is missing', () => {
    const activity: driveactivity_v2.Schema$DriveActivity = {
      timeRange: {
        startTime: '2024-01-10T08:00:00.000Z',
        endTime: '2024-01-10T09:00:00.000Z',
      },
      primaryActionDetail: { edit: {} },
      actors: [{ anonymous: {} }],
      targets: [{ driveItem: { title: 'Sheet', name: 'items/s1' } }],
    };

    expect(mapDriveActivityToEntry(activity)?.occurredAt).toBe(
      '2024-01-10T09:00:00.000Z',
    );
    expect(mapDriveActivityToEntry(activity)?.actorLabel).toBe('Anonymous');
    expect(mapDriveActivityToEntry(activity)?.action).toBe('Edited');
  });

  it('returns null when no time can be resolved', () => {
    const activity: driveactivity_v2.Schema$DriveActivity = {
      primaryActionDetail: { delete: {} },
      actors: [],
      targets: [{ driveItem: { title: 'X' } }],
    };
    expect(mapDriveActivityToEntry(activity)).toBeNull();
  });

  it('summarizes permission and rename actions', () => {
    expect(
      mapDriveActivityToEntry({
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryActionDetail: { permissionChange: {} },
        actors: [{ user: { unknownUser: {} } }],
        targets: [{ driveItem: { title: 'A' } }],
      })?.action,
    ).toBe('Sharing changed');

    expect(
      mapDriveActivityToEntry({
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryActionDetail: { rename: { oldTitle: 'a', newTitle: 'b' } },
        actors: [{ user: { unknownUser: {} } }],
        targets: [{ driveItem: { title: 'b' } }],
      })?.action,
    ).toBe('Renamed');
  });

  it('mapDriveActivities filters null rows', () => {
    expect(
      mapDriveActivities([
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          primaryActionDetail: { edit: {} },
          actors: [{ user: { unknownUser: {} } }],
          targets: [{ driveItem: { title: 'F' } }],
        },
        {
          primaryActionDetail: { edit: {} },
          actors: [],
          targets: [],
        },
      ]),
    ).toHaveLength(1);
  });
});
