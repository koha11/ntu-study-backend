import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { GroupStatus } from '@common/enums';
import { UsersService } from '@modules/users/users.service';
import { GoogleDriveService } from '@common/services/google-drive.service';
import { GoogleCalendarService } from '@common/services/google-calendar.service';
import { GoogleAccessTokenService } from '@modules/auth/services/google-access-token.service';
import { CanvaService } from '@modules/canva/canva.service';
import { InvitationsService } from '@modules/invitations/invitations.service';
import type {
  CreateGroupDto,
  CreateGroupCalendarEventDto,
  CreateMeetEventDto,
  UpdateGroupDto,
} from './dto/group.dto';
import type {
  CreateMeetEventResult,
  CreateGroupCalendarEventParams,
  CreateGroupCalendarEventResult,
  ListedCalendarEvent,
} from '@common/services/google-calendar.service';
import type { GroupInvitation } from './entities/group-invitation.entity';

export interface GroupSummary {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  leader_id: string;
  created_at: Date;
}

export interface MemberRow {
  user_id: string;
  full_name: string;
  email: string;
  role: 'leader' | 'member';
  is_active: boolean;
  joined_at: Date;
}

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly membersRepository: Repository<GroupMember>,
    private readonly usersService: UsersService,
    private readonly googleDriveService: GoogleDriveService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly googleAccessTokenService: GoogleAccessTokenService,
    private readonly canvaService: CanvaService,
    private readonly invitationsService: InvitationsService,
  ) {}

  async create(leaderId: string, dto: CreateGroupDto): Promise<Group> {
    const name = dto.name.trim();
    const reportDate =
      dto.report_date != null && String(dto.report_date).trim() !== ''
        ? new Date(dto.report_date)
        : undefined;

    const group = this.groupsRepository.create({
      name,
      description: dto.description?.trim(),
      tags: dto.tags ?? [],
      leader_id: leaderId,
      status: GroupStatus.ACTIVE,
      ...(reportDate !== undefined ? { report_date: reportDate } : {}),
    });
    const saved = await this.groupsRepository.save(group);

    const membership = this.membersRepository.create({
      group_id: saved.id,
      user_id: leaderId,
      is_active: true,
    });
    await this.membersRepository.save(membership);

    const leader = await this.usersService.findById(leaderId, true);
    if (leader?.google_access_token) {
      const folderUnknown: unknown = await this.googleDriveService.createFolder(
        leader.google_access_token,
        name,
      );
      const folderId = this.extractDriveFolderId(folderUnknown);
      if (folderId) {
        saved.drive_folder_id = folderId;
        await this.googleDriveService.createFolder(
          leader.google_access_token,
          'canva assets',
          folderId,
        );
        await this.groupsRepository.save(saved);
      }
    }

    if (leader?.canva_access_token) {
      const design = await this.canvaService.createPresentation(
        leader.canva_access_token,
        name,
      );
      if (design) {
        saved.canva_file_url = design.viewUrl;
        saved.canva_design_id = design.designId;
        await this.groupsRepository.save(saved);
      }
    }

    return saved;
  }

  async findUserGroups(userId: string): Promise<GroupSummary[]> {
    const memberships = await this.membersRepository.find({
      where: { user_id: userId, is_active: true },
      select: ['group_id'],
    });
    if (memberships.length === 0) {
      return [];
    }
    const groupIds = [...new Set(memberships.map((m) => m.group_id))];
    const groups = await this.groupsRepository.find({
      where: { id: In(groupIds) },
    });

    const counts = await this.membersRepository
      .createQueryBuilder('m')
      .select('m.group_id', 'group_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.group_id IN (:...ids)', { ids: groupIds })
      .andWhere('m.is_active = true')
      .groupBy('m.group_id')
      .getRawMany<{ group_id: string; cnt: string }>();

    const countByGroup = new Map<string, number>();
    for (const row of counts) {
      countByGroup.set(row.group_id, parseInt(row.cnt, 10));
    }

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      member_count: countByGroup.get(g.id) ?? 0,
      leader_id: g.leader_id,
      created_at: g.created_at,
    }));
  }

  async findOneForMember(groupId: string, userId: string): Promise<Group> {
    const group = await this.groupsRepository.findOne({
      where: { id: groupId },
      relations: ['leader', 'members', 'members.user'],
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    await this.assertCanViewGroup(groupId, group, userId);
    return group;
  }

  async update(
    groupId: string,
    actingUserId: string,
    dto: UpdateGroupDto,
  ): Promise<Group> {
    const group = await this.requireGroup(groupId);
    this.assertLeader(group, actingUserId);

    if (dto.name !== undefined) {
      group.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      group.description = dto.description.trim();
    }
    if (dto.tags !== undefined) {
      group.tags = dto.tags;
    }
    if (dto.meet_link !== undefined) {
      if (dto.meet_link === null || dto.meet_link === '') {
        group.meet_link = null;
      } else {
        group.meet_link = dto.meet_link.trim();
      }
    }
    if (dto.report_date !== undefined) {
      if (dto.report_date === null || dto.report_date === '') {
        group.report_date = null;
      } else {
        group.report_date = new Date(dto.report_date);
      }
    }
    if (dto.canva_file_url !== undefined) {
      if (dto.canva_file_url === null || dto.canva_file_url === '') {
        group.canva_file_url = null;
      } else {
        group.canva_file_url = dto.canva_file_url.trim();
      }
    }
    if (dto.doc_file_url !== undefined) {
      if (dto.doc_file_url === null || dto.doc_file_url === '') {
        group.doc_file_url = null;
      } else {
        group.doc_file_url = dto.doc_file_url.trim();
      }
    }
    if (dto.google_calendar_id !== undefined) {
      if (dto.google_calendar_id === null || dto.google_calendar_id === '') {
        group.google_calendar_id = null;
      } else {
        group.google_calendar_id = dto.google_calendar_id.trim();
      }
    }
    return this.groupsRepository.save(group);
  }

  /**
   * List events from the group's shared Google Calendar (leader token).
   * Any active member may view; requires `google_calendar_id` on the group.
   */
  async listGroupCalendarEvents(
    groupId: string,
    viewerUserId: string,
    timeMinIso: string,
    timeMaxIso: string,
  ): Promise<ListedCalendarEvent[]> {
    const group = await this.findOneForMember(groupId, viewerUserId);
    const calendarId = group.google_calendar_id?.trim();
    if (!calendarId) {
      throw new BadRequestException(
        'Group calendar is not configured. Ask the leader to add the Google Calendar ID.',
      );
    }

    const timeMin = new Date(timeMinIso);
    const timeMax = new Date(timeMaxIso);
    if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime())) {
      throw new BadRequestException('Invalid time range');
    }
    if (timeMax.getTime() <= timeMin.getTime()) {
      throw new BadRequestException('time_max must be after time_min');
    }

    const leader = await this.usersService.findById(group.leader_id, true);
    if (!leader) {
      throw new NotFoundException('Group leader not found');
    }

    const accessToken =
      await this.googleAccessTokenService.resolveGoogleAccessToken(leader);
    if (!accessToken) {
      throw new ForbiddenException(
        'Google Calendar access is unavailable for the group leader. The leader may need to sign in again.',
      );
    }

    try {
      return await this.googleCalendarService.listEventsInRange(
        accessToken,
        calendarId,
        timeMin,
        timeMax,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/grant calendar|sign in again/i.test(message)) {
        throw new ForbiddenException(message);
      }
      throw new BadRequestException(message || 'Failed to list calendar events');
    }
  }

  /**
   * Leader-only: create an event on the group's shared calendar (offline / Meet options).
   */
  async createGroupCalendarEventAndInvite(
    groupId: string,
    leaderId: string,
    dto: CreateGroupCalendarEventDto,
  ): Promise<CreateGroupCalendarEventResult> {
    const group = await this.requireGroup(groupId);
    this.assertLeader(group, leaderId);

    if (group.status === GroupStatus.LOCKED) {
      throw new ForbiddenException('Cannot schedule meetings for a locked group');
    }

    const calendarId = group.google_calendar_id?.trim();
    if (!calendarId) {
      throw new BadRequestException(
        'Configure the group Google Calendar ID before scheduling.',
      );
    }

    const start = new Date(dto.start);
    const end = new Date(dto.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end time');
    }
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('End time must be after start time');
    }

    if (dto.mode === 'online') {
      if (!dto.online_option) {
        throw new BadRequestException(
          'online_option is required for online meetings',
        );
      }
      if (
        dto.online_option === 'group_meet_link' &&
        (!group.meet_link || !group.meet_link.trim())
      ) {
        throw new BadRequestException(
          'Set the group Meet link on the group overview before using this option.',
        );
      }
    }

    const members = await this.getMembers(groupId, leaderId);
    const emails = [
      ...new Set(
        members
          .filter((m) => m.is_active && m.email?.trim())
          .map((m) => m.email.trim().toLowerCase()),
      ),
    ];

    if (emails.length === 0) {
      throw new BadRequestException(
        'No active members with an email address to invite',
      );
    }

    const user = await this.usersService.findById(leaderId, true);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const accessToken =
      await this.googleAccessTokenService.resolveGoogleAccessToken(user);
    if (!accessToken) {
      throw new ForbiddenException(
        'Google Calendar access is unavailable. Sign out and sign in again to grant Calendar permission.',
      );
    }

    const summary = dto.summary?.trim() || `${group.name} — NTU Study`;
    const description =
      'Meeting scheduled from NTU Study. Open this event in Google Calendar for details.';

    let params: CreateGroupCalendarEventParams;

    if (dto.mode === 'offline') {
      params = {
        calendarId,
        summary,
        description,
        start,
        end,
        attendeeEmails: emails,
        mode: 'offline',
        place_name: dto.place_name ?? '',
        address_detail: dto.address_detail,
        maps_url: dto.maps_url ?? undefined,
      };
    } else if (dto.online_option === 'group_meet_link') {
      params = {
        calendarId,
        summary,
        description,
        start,
        end,
        attendeeEmails: emails,
        mode: 'online',
        online_option: 'group_meet_link',
        static_meet_url: group.meet_link!.trim(),
      };
    } else {
      params = {
        calendarId,
        summary,
        description,
        start,
        end,
        attendeeEmails: emails,
        mode: 'online',
        online_option: 'one_time_meet',
      };
    }

    try {
      return await this.googleCalendarService.createGroupCalendarEvent(
        accessToken,
        params,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/grant calendar|sign in again/i.test(message)) {
        throw new ForbiddenException(message);
      }
      throw new BadRequestException(message || 'Failed to create Calendar event');
    }
  }

  /**
   * Leader-only: create a one-off Google Calendar event with Meet and invite active members.
   */
  async createMeetEventAndInvite(
    groupId: string,
    leaderId: string,
    dto: CreateMeetEventDto,
  ): Promise<CreateMeetEventResult> {
    const group = await this.requireGroup(groupId);
    this.assertLeader(group, leaderId);
    if (group.status === GroupStatus.LOCKED) {
      throw new ForbiddenException('Cannot schedule meetings for a locked group');
    }

    const start = new Date(dto.start);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Invalid start time');
    }

    let end: Date;
    const endRaw = dto.end?.trim();
    if (endRaw) {
      end = new Date(endRaw);
      if (Number.isNaN(end.getTime())) {
        throw new BadRequestException('Invalid end time');
      }
    } else {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('End time must be after start time');
    }

    const members = await this.getMembers(groupId, leaderId);
    const emails = [
      ...new Set(
        members
          .filter((m) => m.is_active && m.email?.trim())
          .map((m) => m.email.trim().toLowerCase()),
      ),
    ];

    if (emails.length === 0) {
      throw new BadRequestException(
        'No active members with an email address to invite',
      );
    }

    const user = await this.usersService.findById(leaderId, true);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const accessToken =
      await this.googleAccessTokenService.resolveGoogleAccessToken(user);
    if (!accessToken) {
      throw new ForbiddenException(
        'Google Calendar access is unavailable. Sign out and sign in again to grant Calendar permission.',
      );
    }

    try {
      return await this.googleCalendarService.createEventWithMeetLink(
        accessToken,
        {
          summary: `${group.name} — NTU Study`,
          description:
            'Meeting scheduled from NTU Study. Join via Meet or open this event in Google Calendar.',
          start,
          end,
          attendeeEmails: emails,
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/grant calendar|sign in again/i.test(message)) {
        throw new ForbiddenException(message);
      }
      throw new BadRequestException(message || 'Failed to create Calendar event');
    }
  }

  async getMembers(groupId: string, userId: string): Promise<MemberRow[]> {
    const group = await this.requireGroup(groupId);
    await this.assertCanViewGroup(groupId, group, userId);

    const memberships = await this.membersRepository.find({
      where: { group_id: groupId },
      relations: ['user'],
      order: { created_at: 'ASC' },
    });

    const rows: MemberRow[] = memberships.map((m) => ({
      user_id: m.user_id,
      full_name: m.user?.full_name ?? '',
      email: m.user?.email?.trim().toLowerCase() ?? '',
      role: m.user_id === group.leader_id ? 'leader' : 'member',
      is_active: m.is_active,
      joined_at: m.created_at,
    }));
    rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return rows;
  }

  async inviteMember(
    groupId: string,
    leaderId: string,
    email: string,
  ): Promise<GroupInvitation> {
    const group = await this.requireGroup(groupId);
    this.assertLeader(group, leaderId);
    const normalized = email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(normalized);
    if (existingUser) {
      const existingMembership = await this.membersRepository.findOne({
        where: { group_id: groupId, user_id: existingUser.id },
      });
      if (existingMembership) {
        throw new ConflictException('User is already a member of this group');
      }
    }
    return this.invitationsService.createInvitation({
      groupId,
      invitedByUserId: leaderId,
      email: normalized,
    });
  }

  async toggleMemberStatus(
    groupId: string,
    leaderId: string,
    targetUserId: string,
  ): Promise<GroupMember> {
    const group = await this.requireGroup(groupId);
    this.assertLeader(group, leaderId);
    if (targetUserId === group.leader_id) {
      throw new ForbiddenException('Cannot change leader membership status');
    }
    const member = await this.membersRepository.findOne({
      where: { group_id: groupId, user_id: targetUserId },
      relations: ['user'],
    });
    if (!member) {
      throw new NotFoundException('Member not found in this group');
    }
    member.is_active = !member.is_active;
    return this.membersRepository.save(member);
  }

  async removeMember(
    groupId: string,
    leaderId: string,
    targetUserId: string,
  ): Promise<void> {
    const group = await this.requireGroup(groupId);
    this.assertLeader(group, leaderId);
    if (targetUserId === group.leader_id) {
      throw new ForbiddenException('Cannot remove the group leader');
    }
    const member = await this.membersRepository.findOne({
      where: { group_id: groupId, user_id: targetUserId },
    });
    if (!member) {
      throw new NotFoundException('Member not found in this group');
    }
    await this.membersRepository.remove(member);
  }

  private async requireGroup(groupId: string): Promise<Group> {
    const group = await this.groupsRepository.findOne({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return group;
  }

  private assertLeader(group: Group, userId: string): void {
    if (group.leader_id !== userId) {
      throw new ForbiddenException(
        'Only the group leader can perform this action',
      );
    }
  }

  /** Uses DB lookup so access checks work even when Group.members relation fails to join. */
  private async assertCanViewGroup(
    groupId: string,
    group: Group,
    userId: string,
  ): Promise<void> {
    if (group.leader_id === userId) {
      return;
    }
    const membership = await this.membersRepository.findOne({
      where: {
        group_id: groupId,
        user_id: userId,
        is_active: true,
      },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this group');
    }
  }

  /** Google Drive API returns loosely typed metadata from googleapis client */
  private extractDriveFolderId(folder: unknown): string | undefined {
    if (
      folder &&
      typeof folder === 'object' &&
      'id' in folder &&
      typeof (folder as { id: unknown }).id === 'string'
    ) {
      return (folder as { id: string }).id;
    }
    return undefined;
  }
}
