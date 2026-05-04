import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @IsString()
  @IsNotEmpty()
  role!: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsBoolean()
  notification_enabled?: boolean;

  /** Manual Drive quota cap in bytes (decimal string). Null clears the limit. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(/^\d+$/, { message: 'drive_total_quota must be a non-negative integer string' })
  drive_total_quota?: string | null;
}
