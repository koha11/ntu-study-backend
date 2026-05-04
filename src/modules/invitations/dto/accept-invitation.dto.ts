import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  full_name?: string;
}
