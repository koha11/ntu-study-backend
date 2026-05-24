import { DriveItemType } from '@common/enums';

export class DriveItem {
  id!: string;
  group_id!: string;
  drive_file_id!: string;
  parent_drive_id?: string;
  mime_type!: string;
  type!: DriveItemType;
  web_view_link?: string;
  file_size!: number;
  name?: string;
  created_at!: Date;
  updated_at!: Date;
}
