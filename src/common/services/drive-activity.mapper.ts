import type { driveactivity_v2 } from 'googleapis';

export interface DriveActivityEntryDto {
  /** ISO 8601 timestamp */
  occurredAt: string;
  /**
   * Fallback actor identifier when People API enrichment is unavailable
   * (often the numeric account id from Activity API).
   */
  actorLabel: string;
  /** Resolved display name from People API when available. */
  actorDisplayName?: string;
  /** Profile photo URL from People API when available. */
  actorPhotoUrl?: string;
  fileName: string;
  /** Raw Drive file id when available (`items/{id}` parsed). */
  fileId?: string;
  action: string;
}

/** Internal row before People API enrichment (includes resource name for lookup). */
export type DriveActivityEntryMapped = DriveActivityEntryDto & {
  actorPersonResource?: string;
};

type DriveActivity = driveactivity_v2.Schema$DriveActivity;
type ActionDetail = driveactivity_v2.Schema$ActionDetail;
type Actor = driveactivity_v2.Schema$Actor;
type Target = driveactivity_v2.Schema$Target;

function summarizeAction(detail?: ActionDetail | null): string {
  if (!detail) {
    return 'Updated';
  }
  if (detail.create) {
    return 'Created';
  }
  if (detail.delete) {
    return 'Deleted';
  }
  if (detail.edit) {
    return 'Edited';
  }
  if (detail.move) {
    return 'Moved';
  }
  if (detail.rename) {
    return 'Renamed';
  }
  if (detail.permissionChange) {
    return 'Sharing changed';
  }
  if (detail.restore) {
    return 'Restored';
  }
  if (detail.comment) {
    return 'Comment';
  }
  if (detail.appliedLabelChange) {
    return 'Label changed';
  }
  if (detail.settingsChange) {
    return 'Settings changed';
  }
  if (detail.dlpChange) {
    return 'DLP change';
  }
  if (detail.reference) {
    return 'Referenced';
  }
  return 'Updated';
}

function formatUser(
  u: driveactivity_v2.Schema$User | null | undefined,
): string {
  if (!u) {
    return '';
  }
  if (u.deletedUser) {
    return 'Deleted user';
  }
  if (u.unknownUser) {
    return 'Someone';
  }
  if (u.knownUser?.personName) {
    const pn = u.knownUser.personName;
    if (pn.startsWith('people/')) {
      return pn.slice('people/'.length);
    }
    return pn;
  }
  return '';
}

function formatActor(actor?: Actor | null): string {
  if (!actor) {
    return 'Unknown';
  }
  if (actor.anonymous) {
    return 'Anonymous';
  }
  if (actor.administrator) {
    return 'Administrator';
  }
  if (actor.system?.type) {
    return `System (${actor.system.type})`;
  }
  if (actor.impersonation?.impersonatedUser) {
    const s = formatUser(actor.impersonation.impersonatedUser);
    return s || 'Impersonation';
  }
  if (actor.user) {
    const s = formatUser(actor.user);
    return s || 'User';
  }
  return 'Unknown';
}

function extractPersonResource(actor?: Actor | null): string | undefined {
  if (!actor) {
    return undefined;
  }
  const fromUser = actor.user?.knownUser?.personName;
  if (fromUser?.startsWith('people/')) {
    return fromUser;
  }
  const imp = actor.impersonation?.impersonatedUser?.knownUser?.personName;
  if (imp?.startsWith('people/')) {
    return imp;
  }
  return undefined;
}

function pickPrimaryActor(actors?: Actor[] | null): {
  label: string;
  personResource?: string;
} {
  if (!actors?.length) {
    return { label: 'Unknown' };
  }
  for (const a of actors) {
    const label = formatActor(a);
    const personResource = extractPersonResource(a);
    if (label !== 'Unknown' || a.user || a.anonymous) {
      return { label, personResource };
    }
  }
  const first = actors[0];
  return {
    label: formatActor(first),
    personResource: extractPersonResource(first),
  };
}

function parseItemId(name?: string | null): string | undefined {
  if (!name?.startsWith('items/')) {
    return undefined;
  }
  return name.slice('items/'.length) || undefined;
}

function pickTargetTitle(targets?: Target[] | null): {
  title: string;
  fileId?: string;
} {
  if (!targets?.length) {
    return { title: '(no file)' };
  }
  for (const t of targets) {
    if (t.driveItem?.title) {
      return {
        title: t.driveItem.title,
        fileId: parseItemId(t.driveItem.name),
      };
    }
    if (t.drive?.title) {
      return { title: t.drive.title };
    }
  }
  return { title: '(no file)' };
}

function resolveOccurredAt(activity: DriveActivity): string | undefined {
  if (activity.timestamp) {
    return activity.timestamp;
  }
  const tr = activity.timeRange;
  if (tr?.endTime) {
    return tr.endTime;
  }
  if (tr?.startTime) {
    return tr.startTime;
  }
  return undefined;
}

/**
 * Maps a Drive Activity API activity to a single flat row for the UI.
 */
export function mapDriveActivityToEntry(
  activity: DriveActivity,
): DriveActivityEntryMapped | null {
  const occurredAt = resolveOccurredAt(activity);
  if (!occurredAt) {
    return null;
  }

  const { label, personResource } = pickPrimaryActor(activity.actors);
  const { title, fileId } = pickTargetTitle(activity.targets);
  const action = summarizeAction(activity.primaryActionDetail);

  return {
    occurredAt,
    actorLabel: label,
    ...(personResource ? { actorPersonResource: personResource } : {}),
    fileName: title,
    fileId,
    action,
  };
}

export function mapDriveActivities(
  activities: DriveActivity[] | null | undefined,
): DriveActivityEntryMapped[] {
  if (!activities?.length) {
    return [];
  }
  const out: DriveActivityEntryMapped[] = [];
  for (const a of activities) {
    const row = mapDriveActivityToEntry(a);
    if (row) {
      out.push(row);
    }
  }
  return out;
}
