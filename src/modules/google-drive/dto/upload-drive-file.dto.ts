import { IsOptional, IsString } from 'class-validator';

export class UploadDriveFileDto {
  @IsOptional()
  @IsString()
  parentFolderId?: string;
}
