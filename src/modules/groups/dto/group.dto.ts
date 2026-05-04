import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEmail,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  IsUrl,
  IsDateString,
  ValidateIf,
  IsIn,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @MaxLength(100, { each: true })
  tags?: string[];

  /** Project / report due date (YYYY-MM-DD). */
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @IsDateString({ strict: true })
  report_date?: string;
}

export class UpdateGroupDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @MaxLength(100, { each: true })
  tags?: string[];

  /** Google Meet or other meeting URL; null clears. */
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  meet_link?: string | null;

  /** Project / report due date (YYYY-MM-DD); null clears. */
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @IsDateString({ strict: true })
  report_date?: string | null;

  /** Canva view/embed URL; null clears. */
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  canva_file_url?: string | null;

  /** Google Doc or other project document URL; null clears. */
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  doc_file_url?: string | null;

  /** Google Calendar ID for the group's shared calendar; null clears. */
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.length > 0)
  @IsString()
  @MaxLength(512)
  google_calendar_id?: string | null;
}

export class InviteMemberDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;
}

/** POST /groups/:id/calendar/meet-event — ISO 8601 start/end from client */
export class CreateMeetEventDto {
  @IsDateString()
  @IsNotEmpty()
  start!: string;

  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsDateString()
  end?: string;
}

/** GET /groups/:id/calendar/events */
export class ListGroupCalendarEventsQueryDto {
  @IsDateString()
  @IsNotEmpty()
  time_min!: string;

  @IsDateString()
  @IsNotEmpty()
  time_max!: string;
}

/** POST /groups/:id/calendar/events — shared group calendar (leader only) */
export class CreateGroupCalendarEventDto {
  @IsDateString()
  @IsNotEmpty()
  start!: string;

  @IsDateString()
  @IsNotEmpty()
  end!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsIn(['offline', 'online'])
  mode!: 'offline' | 'online';

  @ValidateIf((o: CreateGroupCalendarEventDto) => o.mode === 'offline')
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  place_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address_detail?: string;

  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string' && v.trim().length > 0)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  maps_url?: string | null;

  @ValidateIf((o: CreateGroupCalendarEventDto) => o.mode === 'online')
  @IsIn(['group_meet_link', 'one_time_meet'])
  online_option?: 'group_meet_link' | 'one_time_meet';
}
