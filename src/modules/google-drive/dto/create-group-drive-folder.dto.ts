import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateGroupDriveFolderDto {
  @IsString()
  @MinLength(1, { message: 'Folder name is required' })
  name!: string;

  @IsOptional()
  @IsString()
  parentFolderId?: string;
}
