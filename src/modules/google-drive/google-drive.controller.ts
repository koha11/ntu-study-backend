import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import type { JwtRequestUser } from '@modules/auth/types/jwt-request-user';
import { GoogleAccessTokenService } from '@modules/auth/services/google-access-token.service';
import { GroupsService } from '@modules/groups/groups.service';
import { UsersService } from '@modules/users/users.service';
import { GoogleDriveService as CommonGoogleDriveService } from '@common/services/google-drive.service';
import { CreateGroupDriveFolderDto } from './dto/create-group-drive-folder.dto';
import { UploadDriveFileDto } from './dto/upload-drive-file.dto';
import type { DriveActivityEntryDto } from '@common/services/drive-activity.mapper';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DEFAULT_PAGE_SIZE = 100;

export interface DriveAssetDto {
  id: string;
  name: string;
  type: 'file' | 'folder';
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  lastModifiedBy?: string;
}

export interface DriveQuotaDto {
  total_bytes: string | null;
  used_bytes: string | null;
  quota_last_updated: string | null;
}

export interface GroupDriveActivityResponseDto {
  items: DriveActivityEntryDto[];
  nextPageToken?: string;
}

@Controller('drive')
@UseGuards(JwtAuthGuard)
export class GoogleDriveController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly usersService: UsersService,
    private readonly commonGoogleDriveService: CommonGoogleDriveService,
    private readonly googleAccessTokenService: GoogleAccessTokenService,
  ) {}

  private mapDriveQuota(user: {
    drive_total_quota?: number | string | null;
    drive_used_quota?: number | string | null;
    quota_last_updated?: Date | null;
  }): DriveQuotaDto {
    const tb = user.drive_total_quota;
    const ub = user.drive_used_quota;
    return {
      total_bytes: tb != null ? String(tb) : null,
      used_bytes: ub != null ? String(ub) : null,
      quota_last_updated: user.quota_last_updated?.toISOString() ?? null,
    };
  }

  @Get('me/quota')
  async getMyDriveQuota(
    @Req() req: Request & { user: JwtRequestUser },
  ): Promise<DriveQuotaDto> {
    const row = await this.usersService.findDriveQuotaByUserId(req.user.id);
    if (!row) {
      throw new NotFoundException('User not found');
    }
    return this.mapDriveQuota(row);
  }

  @Post('me/quota/refresh')
  async refreshMyDriveQuota(
    @Req() req: Request & { user: JwtRequestUser },
  ): Promise<DriveQuotaDto> {
    const userId = req.user.id;
    const user = await this.usersService.findById(userId, true);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const accessToken =
      await this.googleAccessTokenService.resolveGoogleAccessToken(user);
    if (!accessToken) {
      throw new ForbiddenException('Google Drive access required');
    }

    const quota =
      await this.commonGoogleDriveService.getAboutStorageQuota(accessToken);
    if (!quota) {
      throw new BadRequestException('Could not read Drive storage quota');
    }

    await this.usersService.updateDriveUsedQuota(userId, quota.usage);

    const row = await this.usersService.findDriveQuotaByUserId(userId);
    if (!row) {
      throw new NotFoundException('User not found');
    }
    return this.mapDriveQuota(row);
  }

  private async requireDriveAccess(
    req: Request & { user: JwtRequestUser },
    groupId: string,
  ): Promise<{ accessToken: string; rootFolderId: string }> {
    const userId = req.user.id;
    const user = await this.usersService.findById(userId, true);
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const accessToken =
      await this.googleAccessTokenService.resolveGoogleAccessToken(user);
    if (!accessToken) {
      throw new ForbiddenException('Google Drive access required');
    }

    const group = await this.groupsService.findOneForMember(groupId, userId);
    const rootFolderId = group.drive_folder_id;
    if (!rootFolderId) {
      throw new BadRequestException('Group has no Drive folder linked');
    }

    return { accessToken, rootFolderId };
  }

  @Get('groups/:groupId/assets')
  async getGroupAssets(
    @Req() req: Request & { user: JwtRequestUser },
    @Param('groupId') groupId: string,
    @Query('folderId') folderId?: string,
  ): Promise<DriveAssetDto[]> {
    const userId = req.user.id;
    const user = await this.usersService.findById(userId, true);
    if (!user) {
      return [];
    }

    const accessToken =
      await this.googleAccessTokenService.resolveGoogleAccessToken(user);
    if (!accessToken) {
      return [];
    }

    const group = await this.groupsService.findOneForMember(groupId, userId);
    const rootFolderId = group.drive_folder_id;
    if (!rootFolderId) {
      return [];
    }

    const targetFolderId =
      folderId != null && folderId !== '' ? folderId : rootFolderId;

    const allowed = await this.commonGoogleDriveService.isResourceUnderFolder(
      accessToken,
      rootFolderId,
      targetFolderId,
    );
    if (!allowed) {
      return [];
    }

    const files = await this.commonGoogleDriveService.listFiles(
      accessToken,
      targetFolderId,
      DEFAULT_PAGE_SIZE,
    );

    return (files ?? []).map(
      (f: {
        id?: string;
        name?: string;
        mimeType?: string;
        webViewLink?: string;
        modifiedTime?: string;
        lastModifyingUser?: {
          displayName?: string | null;
          emailAddress?: string | null;
        };
      }) => {
        const display =
          f.lastModifyingUser?.displayName?.trim() ||
          f.lastModifyingUser?.emailAddress?.trim() ||
          undefined;
        return {
          id: f.id ?? '',
          name: f.name ?? '',
          mimeType: f.mimeType ?? '',
          type:
            f.mimeType === FOLDER_MIME ? ('folder' as const) : ('file' as const),
          webViewLink: f.webViewLink,
          modifiedTime: f.modifiedTime,
          lastModifiedBy: display,
        };
      },
    );
  }

  @Get('groups/:groupId/activity')
  async getGroupDriveActivity(
    @Req() req: Request & { user: JwtRequestUser },
    @Param('groupId') groupId: string,
    @Query('pageToken') pageToken?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ): Promise<GroupDriveActivityResponseDto> {
    const userId = req.user.id;
    const user = await this.usersService.findById(userId, true);
    if (!user) {
      return { items: [] };
    }

    const accessToken =
      await this.googleAccessTokenService.resolveGoogleAccessToken(user);
    if (!accessToken) {
      return { items: [] };
    }

    const group = await this.groupsService.findOneForMember(groupId, userId);
    const rootFolderId = group.drive_folder_id;
    if (!rootFolderId) {
      return { items: [] };
    }

    let pageSize = Number.parseInt(pageSizeRaw ?? '', 10);
    if (!Number.isFinite(pageSize) || pageSize < 1) {
      pageSize = 25;
    }
    pageSize = Math.min(pageSize, 50);

    const result = await this.commonGoogleDriveService.queryFolderActivity(
      accessToken,
      rootFolderId,
      {
        pageToken: pageToken?.trim() || undefined,
        pageSize,
      },
    );

    if (!result) {
      return { items: [] };
    }

    return {
      items: result.items,
      nextPageToken: result.nextPageToken ?? undefined,
    };
  }

  @Post('groups/:groupId/folders')
  async createGroupDriveFolder(
    @Req() req: Request & { user: JwtRequestUser },
    @Param('groupId') groupId: string,
    @Body() dto: CreateGroupDriveFolderDto,
  ): Promise<{ id: string; name: string; webViewLink?: string }> {
    const { accessToken, rootFolderId } = await this.requireDriveAccess(
      req,
      groupId,
    );

    const parentId =
      dto.parentFolderId != null && dto.parentFolderId.trim() !== ''
        ? dto.parentFolderId.trim()
        : rootFolderId;

    const parentOk = await this.commonGoogleDriveService.isResourceUnderFolder(
      accessToken,
      rootFolderId,
      parentId,
    );
    if (!parentOk) {
      throw new ForbiddenException('Invalid parent folder');
    }

    const created = await this.commonGoogleDriveService.createFolder(
      accessToken,
      dto.name.trim(),
      parentId,
    );
    if (!created?.id) {
      throw new BadRequestException('Could not create folder');
    }

    return {
      id: created.id,
      name: created.name ?? dto.name.trim(),
      webViewLink: created.webViewLink,
    };
  }

  @Get('groups/:groupId/files/:fileId/content')
  async getGroupDriveFileContent(
    @Req() req: Request & { user: JwtRequestUser },
    @Param('groupId') groupId: string,
    @Param('fileId') fileId: string,
  ): Promise<StreamableFile> {
    const { accessToken, rootFolderId } = await this.requireDriveAccess(
      req,
      groupId,
    );

    const allowed = await this.commonGoogleDriveService.isResourceUnderFolder(
      accessToken,
      rootFolderId,
      fileId,
    );
    if (!allowed) {
      throw new ForbiddenException('File not in group Drive folder');
    }

    const result =
      await this.commonGoogleDriveService.getFileContentStreamForPreview(
        accessToken,
        fileId,
      );
    if (!result) {
      throw new BadRequestException('Could not load file');
    }

    return new StreamableFile(result.stream, {
      type: result.mimeType,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    });
  }

  @Post('groups/:groupId/uploads')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 52_428_800 } }),
  )
  async uploadGroupDriveFile(
    @Req() req: Request & { user: JwtRequestUser },
    @Param('groupId') groupId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadDriveFileDto,
  ): Promise<{ id: string; name: string; webViewLink?: string }> {
    if (!file?.originalname) {
      throw new BadRequestException('File is required');
    }

    const { accessToken, rootFolderId } = await this.requireDriveAccess(
      req,
      groupId,
    );

    const parentId =
      body.parentFolderId != null && body.parentFolderId.trim() !== ''
        ? body.parentFolderId.trim()
        : rootFolderId;

    const parentOk = await this.commonGoogleDriveService.isResourceUnderFolder(
      accessToken,
      rootFolderId,
      parentId,
    );
    if (!parentOk) {
      throw new ForbiddenException('Invalid parent folder');
    }

    const mime =
      file.mimetype && file.mimetype !== ''
        ? file.mimetype
        : 'application/octet-stream';

    const created = await this.commonGoogleDriveService.uploadFile(
      accessToken,
      file.originalname,
      file.buffer,
      mime,
      parentId,
    );

    if (!created?.id) {
      throw new BadRequestException('Could not upload file');
    }

    return {
      id: created.id,
      name: created.name ?? file.originalname,
      webViewLink: created.webViewLink,
    };
  }

  @Post('groups/:groupId/sync')
  syncGroupDrive(@Param('groupId') _groupId: string) {
    // TODO: Sync drive
    return {};
  }
}
