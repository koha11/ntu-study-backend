import { StreamableFile } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'node:stream';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleDriveController } from './google-drive.controller';
import { GroupsService } from '@modules/groups/groups.service';
import { UsersService } from '@modules/users/users.service';
import { GoogleDriveService as CommonGoogleDriveService } from '@common/services/google-drive.service';
import { GoogleAccessTokenService } from '@modules/auth/services/google-access-token.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

describe('GoogleDriveController', () => {
  let controller: GoogleDriveController;
  let groupsService: { findOneForMember: ReturnType<typeof vi.fn> };
  let usersService: { findById: ReturnType<typeof vi.fn> };
  let commonDrive: {
    listFiles: ReturnType<typeof vi.fn>;
    isResourceUnderFolder: ReturnType<typeof vi.fn>;
    createFolder: ReturnType<typeof vi.fn>;
    uploadFile: ReturnType<typeof vi.fn>;
    getFileContentStreamForPreview: ReturnType<typeof vi.fn>;
    queryFolderActivity: ReturnType<typeof vi.fn>;
  };
  let googleAccessTokenService: {
    resolveGoogleAccessToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    groupsService = {
      findOneForMember: vi.fn(),
    };
    usersService = {
      findById: vi.fn(),
    };
    commonDrive = {
      listFiles: vi.fn(),
      isResourceUnderFolder: vi.fn().mockResolvedValue(true),
      createFolder: vi.fn(),
      uploadFile: vi.fn(),
      getFileContentStreamForPreview: vi.fn(),
      queryFolderActivity: vi.fn(),
    };
    googleAccessTokenService = {
      resolveGoogleAccessToken: vi.fn(async (user: { google_access_token?: string }) =>
        user?.google_access_token ?? null,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleDriveController],
      providers: [
        { provide: GroupsService, useValue: groupsService },
        { provide: UsersService, useValue: usersService },
        { provide: CommonGoogleDriveService, useValue: commonDrive },
        {
          provide: GoogleAccessTokenService,
          useValue: googleAccessTokenService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(GoogleDriveController);
  });

  it('calls listFiles with group drive_folder_id by default', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root-folder',
    });
    commonDrive.listFiles.mockResolvedValue([
      {
        id: 'f1',
        name: 'Doc',
        mimeType: 'application/vnd.google-apps.document',
        webViewLink: 'https://docs.google.com/...',
      },
    ]);

    const req = { user: { id: 'u1' } } as never;
    const result = await controller.getGroupAssets(req, 'g1', undefined);

    expect(groupsService.findOneForMember).toHaveBeenCalledWith('g1', 'u1');
    expect(usersService.findById).toHaveBeenCalledWith('u1', true);
    expect(commonDrive.listFiles).toHaveBeenCalledWith(
      'tok',
      'root-folder',
      expect.any(Number),
    );
    expect(result).toEqual([
      {
        id: 'f1',
        name: 'Doc',
        type: 'file',
        mimeType: 'application/vnd.google-apps.document',
        webViewLink: 'https://docs.google.com/...',
      },
    ]);
  });

  it('uses folderId query when provided', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root-folder',
    });
    commonDrive.listFiles.mockResolvedValue([
      {
        id: 'nested',
        name: 'Inner',
        mimeType: 'application/vnd.google-apps.folder',
        webViewLink: undefined,
      },
    ]);

    const req = { user: { id: 'u1' } } as never;
    await controller.getGroupAssets(req, 'g1', 'sub-folder-id');

    expect(commonDrive.isResourceUnderFolder).toHaveBeenCalledWith(
      'tok',
      'root-folder',
      'sub-folder-id',
    );
    expect(commonDrive.listFiles).toHaveBeenCalledWith(
      'tok',
      'sub-folder-id',
      expect.any(Number),
    );
  });

  it('getGroupDriveActivity calls queryFolderActivity for group root folder', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root-folder',
    });
    commonDrive.queryFolderActivity.mockResolvedValue({
      items: [
        {
          occurredAt: '2024-01-01T00:00:00.000Z',
          actorLabel: 'Some user',
          fileName: 'a.txt',
          fileId: 'file-1',
          action: 'Created',
        },
      ],
      nextPageToken: 'next-1',
    });

    const req = { user: { id: 'u1' } } as never;
    const result = await controller.getGroupDriveActivity(
      req,
      'g1',
      undefined,
      undefined,
    );

    expect(commonDrive.queryFolderActivity).toHaveBeenCalledWith(
      'tok',
      'root-folder',
      { pageToken: undefined, pageSize: 25 },
    );
    expect(result).toEqual({
      items: [
        {
          occurredAt: '2024-01-01T00:00:00.000Z',
          actorLabel: 'Some user',
          fileName: 'a.txt',
          fileId: 'file-1',
          action: 'Created',
        },
      ],
      nextPageToken: 'next-1',
    });
  });

  it('getGroupDriveActivity returns empty when user has no Google token', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: null,
    });
    googleAccessTokenService.resolveGoogleAccessToken.mockResolvedValueOnce(
      null,
    );

    const req = { user: { id: 'u1' } } as never;
    const result = await controller.getGroupDriveActivity(req, 'g1');

    expect(result).toEqual({ items: [] });
    expect(commonDrive.queryFolderActivity).not.toHaveBeenCalled();
  });

  it('createGroupDriveFolder calls createFolder with root when parent omitted', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root-folder',
    });
    commonDrive.createFolder.mockResolvedValue({
      id: 'new-id',
      name: 'Sub',
      webViewLink: 'https://drive.google.com/...',
    });

    const req = { user: { id: 'u1' } } as never;
    const result = await controller.createGroupDriveFolder(req, 'g1', {
      name: 'Sub',
    });

    expect(commonDrive.isResourceUnderFolder).toHaveBeenCalledWith(
      'tok',
      'root-folder',
      'root-folder',
    );
    expect(commonDrive.createFolder).toHaveBeenCalledWith(
      'tok',
      'Sub',
      'root-folder',
    );
    expect(result).toEqual({
      id: 'new-id',
      name: 'Sub',
      webViewLink: 'https://drive.google.com/...',
    });
  });

  it('createGroupDriveFolder rejects invalid parent', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root-folder',
    });
    commonDrive.isResourceUnderFolder.mockResolvedValueOnce(false);

    const req = { user: { id: 'u1' } } as never;
    await expect(
      controller.createGroupDriveFolder(req, 'g1', {
        name: 'Sub',
        parentFolderId: 'evil',
      }),
    ).rejects.toThrow(/Invalid parent folder/);
    expect(commonDrive.createFolder).not.toHaveBeenCalled();
  });

  it('uploadGroupDriveFile calls uploadFile with buffer and parent', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root-folder',
    });
    commonDrive.uploadFile.mockResolvedValue({
      id: 'file-id',
      name: 'a.pdf',
      webViewLink: 'https://drive.google.com/file/d/file-id',
    });

    const req = { user: { id: 'u1' } } as never;
    const buf = Buffer.from('x');
    const file = {
      originalname: 'a.pdf',
      mimetype: 'application/pdf',
      buffer: buf,
    } as Express.Multer.File;

    const result = await controller.uploadGroupDriveFile(req, 'g1', file, {
      parentFolderId: 'root-folder',
    });

    expect(commonDrive.uploadFile).toHaveBeenCalledWith(
      'tok',
      'a.pdf',
      buf,
      'application/pdf',
      'root-folder',
    );
    expect(result.id).toBe('file-id');
  });

  it('getGroupDriveFileContent returns StreamableFile when preview succeeds', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root-folder',
    });
    const stream = Readable.from(Buffer.from('bytes'));
    commonDrive.getFileContentStreamForPreview.mockResolvedValue({
      stream,
      mimeType: 'application/pdf',
      filename: 'a.pdf',
    });

    const req = { user: { id: 'u1' } } as never;
    const out = await controller.getGroupDriveFileContent(req, 'g1', 'fid');

    expect(commonDrive.isResourceUnderFolder).toHaveBeenCalledWith(
      'tok',
      'root-folder',
      'fid',
    );
    expect(commonDrive.getFileContentStreamForPreview).toHaveBeenCalledWith(
      'tok',
      'fid',
    );
    expect(out).toBeInstanceOf(StreamableFile);
  });

  it('getGroupDriveFileContent rejects when file not under group folder', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root-folder',
    });
    commonDrive.isResourceUnderFolder.mockResolvedValueOnce(false);

    const req = { user: { id: 'u1' } } as never;
    await expect(
      controller.getGroupDriveFileContent(req, 'g1', 'fid'),
    ).rejects.toThrow(/not in group Drive folder/);
    expect(commonDrive.getFileContentStreamForPreview).not.toHaveBeenCalled();
  });

  it('returns [] when user has no google_access_token', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: undefined,
      google_refresh_token: undefined,
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root-folder',
    });

    const req = { user: { id: 'u1' } } as never;
    const result = await controller.getGroupAssets(req, 'g1', undefined);

    expect(commonDrive.listFiles).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('returns [] when group has no drive_folder_id', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: null,
    });

    const req = { user: { id: 'u1' } } as never;
    const result = await controller.getGroupAssets(req, 'g1', undefined);

    expect(commonDrive.listFiles).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('maps folder mimeType to type folder', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root',
    });
    commonDrive.listFiles.mockResolvedValue([
      {
        id: 'fld',
        name: 'Sub',
        mimeType: 'application/vnd.google-apps.folder',
      },
    ]);

    const req = { user: { id: 'u1' } } as never;
    const result = await controller.getGroupAssets(req, 'g1', undefined);

    expect(result[0].type).toBe('folder');
  });

  it('maps modifiedTime and lastModifiedBy from Drive list payload', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root-folder',
    });
    commonDrive.listFiles.mockResolvedValue([
      {
        id: 'f1',
        name: 'Doc.pdf',
        mimeType: 'application/pdf',
        modifiedTime: '2026-05-01T12:00:00.000Z',
        lastModifyingUser: {
          displayName: 'Alice Lee',
          emailAddress: 'alice@example.com',
        },
      },
    ]);

    const req = { user: { id: 'u1' } } as never;
    const result = await controller.getGroupAssets(req, 'g1', undefined);

    expect(result[0]).toMatchObject({
      modifiedTime: '2026-05-01T12:00:00.000Z',
      lastModifiedBy: 'Alice Lee',
    });
  });

  it('prefers displayName over emailAddress for lastModifiedBy', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u1',
      google_access_token: 'tok',
    });
    groupsService.findOneForMember.mockResolvedValue({
      id: 'g1',
      drive_folder_id: 'root-folder',
    });
    commonDrive.listFiles.mockResolvedValue([
      {
        id: 'f1',
        name: 'Doc.pdf',
        mimeType: 'application/pdf',
        lastModifyingUser: {
          displayName: '',
          emailAddress: 'only@email.com',
        },
      },
    ]);

    const req = { user: { id: 'u1' } } as never;
    const result = await controller.getGroupAssets(req, 'g1', undefined);

    expect(result[0].lastModifiedBy).toBe('only@email.com');
  });
});
