import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Group } from '@modules/groups/entities/group.entity';
import { GroupMember } from '@modules/groups/entities/group-member.entity';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { TasksService } from '@modules/tasks/tasks.service';
import { UsersService } from '@modules/users/users.service';
import { GoogleDriveService } from '@common/services/google-drive.service';
import { GoogleCalendarService } from '@common/services/google-calendar.service';
import { GoogleAccessTokenService } from '@modules/auth/services/google-access-token.service';
import { TaskStatus } from '@common/enums';
import type {
  DashboardResponseDto,
  RecentActivityItemDto,
  UpcomingItemDto,
} from './dto/dashboard-response.dto';

const UPCOMING_DAYS = 30;
const MAX_RECENT_ACTIVITY = 10;
const DRIVE_PAGE_SIZE = 5;

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly membersRepository: Repository<GroupMember>,
    private readonly notificationsService: NotificationsService,
    private readonly tasksService: TasksService,
    private readonly usersService: UsersService,
    private readonly googleDriveService: GoogleDriveService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly googleAccessTokenService: GoogleAccessTokenService,
  ) {}

  async getDashboard(userId: string): Promise<DashboardResponseDto> {
    const user = await this.usersService.findById(userId, true);
    const accessToken = user
      ? await this.googleAccessTokenService.resolveGoogleAccessToken(user)
      : null;

    const groups = await this.findUserGroupsFull(userId);

    const now = new Date();
    const timeMax = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);

    const [notifResult, driveResult, taskResult, calendarResult] =
      await Promise.allSettled([
        this.notificationsService.getUserNotifications(userId),

        Promise.allSettled(
          accessToken
            ? groups
                .filter((g) => g.drive_folder_id)
                .map((g) =>
                  this.googleDriveService
                    .queryFolderActivity(accessToken, g.drive_folder_id!, {
                      pageSize: DRIVE_PAGE_SIZE,
                    })
                    .then((r) => ({
                      groupId: g.id,
                      groupName: g.name,
                      items: r?.items ?? [],
                    })),
                )
            : [],
        ),

        this.tasksService.findAssignedGroupTasks(userId),

        Promise.allSettled(
          groups
            .filter((g) => g.google_calendar_id)
            .map((g) =>
              this.fetchGroupCalendarEvents(
                g,
                now.toISOString(),
                timeMax.toISOString(),
              ),
            ),
        ),
      ]);

    // ── Recent Activity ────────────────────────────────────────────────────────

    const recentActivity: RecentActivityItemDto[] = [];

    const notifications =
      notifResult.status === 'fulfilled' ? notifResult.value : [];
    for (const n of notifications) {
      recentActivity.push({
        kind: 'notification',
        occurredAt: n.created_at.toISOString(),
        notification: {
          id: n.id,
          type: n.type,
          message: n.message,
          isRead: n.is_read,
          relatedEntityType: n.related_entity_type ?? undefined,
          relatedEntityId: n.related_entity_id ?? undefined,
        },
      });
    }

    const driveSettled =
      driveResult.status === 'fulfilled' ? driveResult.value : [];
    for (const r of driveSettled) {
      if (r.status !== 'fulfilled') continue;
      const { groupId, groupName, items } = r.value;
      for (const entry of items) {
        recentActivity.push({
          kind: 'drive_activity',
          occurredAt: entry.occurredAt,
          driveActivity: {
            fileName: entry.fileName,
            fileId: entry.fileId ?? undefined,
            action: entry.action,
            actorLabel: entry.actorLabel,
            actorDisplayName: entry.actorDisplayName ?? undefined,
            actorPhotoUrl: entry.actorPhotoUrl ?? undefined,
            groupId,
            groupName,
          },
        });
      }
    }

    recentActivity.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    // ── Upcoming ───────────────────────────────────────────────────────────────

    const upcoming: UpcomingItemDto[] = [];
    const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

    const tasks = taskResult.status === 'fulfilled' ? taskResult.value : [];
    for (const task of tasks) {
      if (task.status === TaskStatus.DONE || task.status === TaskStatus.FAILED)
        continue;
      if (!task.due_date || task.due_date < now) continue;
      upcoming.push({
        kind: 'task',
        date: task.due_date.toISOString(),
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          groupId: task.group_id ?? '',
          groupName: task.group_id ? (groupNameById.get(task.group_id) ?? '') : '',
        },
      });
    }

    const calSettled =
      calendarResult.status === 'fulfilled' ? calendarResult.value : [];
    for (const r of calSettled) {
      if (r.status !== 'fulfilled') continue;
      const { groupId, groupName, events } = r.value;
      for (const event of events) {
        const startStr = event.start.dateTime ?? event.start.date ?? '';
        if (!startStr || new Date(startStr) < now) continue;
        upcoming.push({
          kind: 'calendar_event',
          date: startStr,
          calendarEvent: {
            id: event.id,
            summary: event.summary,
            start: {
              dateTime: event.start.dateTime ?? undefined,
              date: event.start.date ?? undefined,
            },
            end: {
              dateTime: event.end.dateTime ?? undefined,
              date: event.end.date ?? undefined,
            },
            htmlLink: event.html_link,
            groupId,
            groupName,
          },
        });
      }
    }

    upcoming.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return {
      recentActivity: recentActivity.slice(0, MAX_RECENT_ACTIVITY),
      upcoming,
    };
  }

  private async fetchGroupCalendarEvents(
    group: Group,
    timeMinIso: string,
    timeMaxIso: string,
  ) {
    const calendarId = group.google_calendar_id?.trim();
    if (!calendarId) {
      return { groupId: group.id, groupName: group.name, events: [] };
    }
    const leader = await this.usersService.findById(group.leader_id, true);
    if (!leader) {
      return { groupId: group.id, groupName: group.name, events: [] };
    }
    const token =
      await this.googleAccessTokenService.resolveGoogleAccessToken(leader);
    if (!token) {
      return { groupId: group.id, groupName: group.name, events: [] };
    }
    const events = await this.googleCalendarService
      .listEventsInRange(token, calendarId, new Date(timeMinIso), new Date(timeMaxIso))
      .catch(() => []);
    return { groupId: group.id, groupName: group.name, events };
  }

  private async findUserGroupsFull(userId: string): Promise<Group[]> {
    const memberships = await this.membersRepository.find({
      where: { user_id: userId, is_active: true },
      select: ['group_id'],
    });
    if (!memberships.length) return [];
    const groupIds = [...new Set(memberships.map((m) => m.group_id))];
    return this.groupsRepository.find({ where: { id: In(groupIds) } });
  }
}
