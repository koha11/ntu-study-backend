import { Controller, Get, Post, Param } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service';

@Controller('drive')
export class GoogleDriveController {
  constructor(private readonly googleDriveService: GoogleDriveService) {}

  @Get('groups/:groupId/assets')
  getGroupAssets(@Param('groupId') _groupId: string) {
    // TODO: Get group assets
    return [];
  }

  @Post('groups/:groupId/sync')
  syncGroupDrive(@Param('groupId') _groupId: string) {
    // TODO: Sync drive
    return {};
  }
}
