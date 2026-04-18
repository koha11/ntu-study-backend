import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

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
  @IsString()
  full_name?: string;

  @IsString()
  avatar_url?: string;

  @IsNotEmpty()
  notification_enabled?: boolean;
}
