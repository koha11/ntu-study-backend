import { Injectable, Logger } from '@nestjs/common';
import { DriveItem } from './entities/drive-item.entity';

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  async createGroupFolder(
    _groupId: string,
    _groupName: string,
  ): Promise<string> {
    this.logger.debug(`createGroupFolder called for group ${_groupId}`);
    // TODO: Create Google Drive folder for group
    return 'folder-id';
  }

  async createCanvaFile(_groupId: string): Promise<string> {
    this.logger.debug(`createCanvaFile called for group ${_groupId}`);
    // TODO: Create Canva file for group
    return 'file-url';
  }

  async createGoogleDoc(_groupId: string): Promise<string> {
    this.logger.debug(`createGoogleDoc called for group ${_groupId}`);
    // TODO: Create Google Doc for group
    return 'file-url';
  }

  async syncGroupDrive(_groupId: string): Promise<void> {
    this.logger.debug(`syncGroupDrive called for group ${_groupId}`);
    // TODO: Sync Google Drive items to database
  }

  async getGroupAssets(_groupId: string): Promise<DriveItem[]> {
    this.logger.debug(`getGroupAssets called for group ${_groupId}`);
    // TODO: Get all assets for group
    return [];
  }
}
