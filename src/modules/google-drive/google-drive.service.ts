import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriveItem } from './entities/drive-item.entity';

@Injectable()
export class GoogleDriveService {
  constructor(
    @InjectRepository(DriveItem)
    private driveItemsRepository: Repository<DriveItem>,
  ) {}

  async createGroupFolder(
    _groupId: string,
    _groupName: string,
  ): Promise<string> {
    // TODO: Create Google Drive folder for group
    return 'folder-id';
  }

  async createCanvaFile(_groupId: string): Promise<string> {
    // TODO: Create Canva file for group
    return 'file-url';
  }

  async createGoogleDoc(_groupId: string): Promise<string> {
    // TODO: Create Google Doc for group
    return 'file-url';
  }

  async syncGroupDrive(_groupId: string): Promise<void> {
    // TODO: Sync Google Drive items to database
  }

  async getGroupAssets(_groupId: string): Promise<DriveItem[]> {
    // TODO: Get all assets for group
    return [];
  }
}
