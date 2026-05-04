import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'node:stream';
import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import {
  mapDriveActivities,
  type DriveActivityEntryDto,
  type DriveActivityEntryMapped,
} from './drive-activity.mapper';

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  constructor() {}

  /**
   * Get authenticated Google Drive client using user's OAuth2 access token
   * @param accessToken User's Google OAuth2 access token
   * @returns Authenticated drive client
   */
  private getDriveClient(accessToken: string): drive_v3.Drive {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    return google.drive({
      version: 'v3',
      auth: oauth2Client,
    });
  }

  private getDriveActivityClient(accessToken: string) {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });
    return google.driveactivity({
      version: 'v2',
      auth: oauth2Client,
    });
  }

  private getPeopleClient(accessToken: string) {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });
    return google.people({
      version: 'v1',
      auth: oauth2Client,
    });
  }

  /**
   * Resolve display name + photo for `people/{id}` from Drive Activity via People API.
   */
  private async fetchPersonProfile(
    accessToken: string,
    resourceName: string,
  ): Promise<{ displayName?: string; photoUrl?: string } | null> {
    try {
      const people = this.getPeopleClient(accessToken);
      const res = await people.people.get({
        resourceName,
        personFields: 'names,photos',
      });
      const data = res.data;
      const primaryName =
        data.names?.find((n) => n.metadata?.primary) ?? data.names?.[0];
      const displayName =
        primaryName?.displayName?.trim() ||
        [primaryName?.givenName, primaryName?.familyName]
          .filter((x): x is string => Boolean(x?.trim()))
          .join(' ')
          .trim() ||
        undefined;
      const primaryPhoto =
        data.photos?.find((p) => p.metadata?.primary) ?? data.photos?.[0];
      const photoUrl = primaryPhoto?.url?.trim() || undefined;
      if (!displayName && !photoUrl) {
        return null;
      }
      return { displayName, photoUrl };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.debug(`People API get failed for ${resourceName}: ${msg}`);
      return null;
    }
  }

  private async enrichDriveActivityActors(
    accessToken: string,
    mapped: DriveActivityEntryMapped[],
  ): Promise<DriveActivityEntryDto[]> {
    const ids = [
      ...new Set(
        mapped
          .map((r) => r.actorPersonResource)
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    const cache = new Map<
      string,
      { displayName?: string; photoUrl?: string }
    >();
    await Promise.all(
      ids.map(async (resourceName) => {
        const profile = await this.fetchPersonProfile(
          accessToken,
          resourceName,
        );
        if (profile) {
          cache.set(resourceName, profile);
        }
      }),
    );

    return mapped.map(({ actorPersonResource, ...rest }) => {
      const p = actorPersonResource
        ? cache.get(actorPersonResource)
        : undefined;
      return {
        ...rest,
        ...(p?.displayName ? { actorDisplayName: p.displayName } : {}),
        ...(p?.photoUrl ? { actorPhotoUrl: p.photoUrl } : {}),
      };
    });
  }

  /**
   * Query Drive Activity for a folder and all descendants (Google Drive Activity API v2).
   */
  async queryFolderActivity(
    accessToken: string,
    folderId: string,
    options?: { pageToken?: string; pageSize?: number },
  ): Promise<{
    items: DriveActivityEntryDto[];
    nextPageToken?: string | null;
  } | null> {
    try {
      const client = this.getDriveActivityClient(accessToken);
      const rawSize = options?.pageSize ?? 25;
      const pageSize = Math.min(Math.max(rawSize, 1), 50);
      const response = await client.activity.query({
        requestBody: {
          ancestorName: `items/${folderId}`,
          pageSize,
          pageToken: options?.pageToken?.trim() || undefined,
        },
      });

      const activities = response.data.activities ?? [];
      const mapped = mapDriveActivities(activities);
      const items = await this.enrichDriveActivityActors(accessToken, mapped);

      return {
        items,
        nextPageToken: response.data.nextPageToken ?? undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to query Drive activity: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Create a folder in Google Drive
   * @param accessToken User's Google OAuth2 access token
   * @param folderName Name of the folder to create
   * @param parentFolderId Optional parent folder ID
   * @returns Folder metadata
   */
  async createFolder(
    accessToken: string,
    folderName: string,
    parentFolderId?: string,
  ): Promise<any> {
    try {
      const driveClient = this.getDriveClient(accessToken);

      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined,
      };

      const response = await driveClient.files.create({
        requestBody: fileMetadata,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      } as any);

      this.logger.log(
        `Created folder: ${folderName} (ID: ${response.data.id})`,
      );
      return response.data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create folder: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Upload a file to Google Drive
   * @param accessToken User's Google OAuth2 access token
   * @param fileName Name of the file
   * @param fileContent File content (Buffer or Stream)
   * @param mimeType MIME type of the file
   * @param parentFolderId Optional parent folder ID
   * @returns File metadata
   */
  async uploadFile(
    accessToken: string,
    fileName: string,
    fileContent: Buffer | NodeJS.ReadableStream | Uint8Array,
    mimeType: string,
    parentFolderId?: string,
  ): Promise<any> {
    try {
      const driveClient = this.getDriveClient(accessToken);

      const fileMetadata = {
        name: fileName,
        parents: parentFolderId ? [parentFolderId] : undefined,
      };

      /** googleapis multipart upload expects a stream (`pipe`), not a raw Buffer from Multer */
      const bodyStream = this.toUploadReadable(fileContent);

      const media = {
        mimeType: mimeType,
        body: bodyStream,
      };

      const response = await driveClient.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      } as any);

      this.logger.log(`Uploaded file: ${fileName} (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to upload file: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Multer supplies `Buffer`; googleapis media upload expects a Readable stream.
   */
  private toUploadReadable(
    fileContent: Buffer | NodeJS.ReadableStream | Uint8Array,
  ): Readable {
    if (
      fileContent &&
      typeof (fileContent as NodeJS.ReadableStream).pipe === 'function'
    ) {
      return fileContent as Readable;
    }
    if (Buffer.isBuffer(fileContent)) {
      return Readable.from(fileContent);
    }
    if (fileContent instanceof Uint8Array) {
      return Readable.from(Buffer.from(fileContent));
    }
    throw new TypeError('Unsupported file body for Drive upload');
  }

  /**
   * List files in a folder
   * @param accessToken User's Google OAuth2 access token
   * @param folderId Folder ID to list
   * @param pageSize Number of files to return
   * @returns List of files
   */
  async listFiles(
    accessToken: string,
    folderId: string,
    pageSize: number = 10,
  ): Promise<any[]> {
    try {
      const driveClient = this.getDriveClient(accessToken);

      const query = `'${folderId}' in parents and trashed=false`;
      const response = await driveClient.files.list({
        q: query,
        spaces: 'drive',
        pageSize: pageSize,
        fields:
          'files(id, name, mimeType, webViewLink, modifiedTime, lastModifyingUser(displayName,emailAddress))',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      } as any);

      return response.data.files || [];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to list files: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Read file metadata (parents chain used for group-folder checks).
   */
  async getFileMetadata(
    accessToken: string,
    fileId: string,
  ): Promise<{
    id: string;
    name: string;
    mimeType: string;
    parents?: string[];
  } | null> {
    try {
      const driveClient = this.getDriveClient(accessToken);
      const response = await driveClient.files.get({
        fileId,
        fields: 'id, name, mimeType, parents',
        supportsAllDrives: true,
      } as any);
      const d = response.data;
      return {
        id: d.id ?? '',
        name: d.name ?? '',
        mimeType: d.mimeType ?? '',
        parents: d.parents ?? [],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get file metadata: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Whether {@link resourceId} is the root folder or has an ancestor chain to {@link rootFolderId}.
   */
  async isResourceUnderFolder(
    accessToken: string,
    rootFolderId: string,
    resourceId: string,
  ): Promise<boolean> {
    if (resourceId === rootFolderId) {
      return true;
    }
    let current: string | undefined = resourceId;
    for (let depth = 0; depth < 64; depth++) {
      const meta = await this.getFileMetadata(accessToken, current);
      if (!meta) {
        return false;
      }
      const parents = meta.parents ?? [];
      if (parents.length === 0) {
        return false;
      }
      const parent = parents[0];
      if (parent === rootFolderId) {
        return true;
      }
      current = parent;
    }
    return false;
  }

  /**
   * Stream file bytes for preview (export Google Workspace types; raw media otherwise).
   */
  async getFileContentStreamForPreview(
    accessToken: string,
    fileId: string,
  ): Promise<{
    stream: Readable;
    mimeType: string;
    filename: string;
  } | null> {
    try {
      const meta = await this.getFileMetadata(accessToken, fileId);
      if (!meta?.id) {
        return null;
      }
      if (meta.mimeType === 'application/vnd.google-apps.folder') {
        return null;
      }

      const driveClient = this.getDriveClient(accessToken);
      const exportMime = exportMimeForGoogleWorkspace(meta.mimeType);

      if (exportMime) {
        const response = await driveClient.files.export(
          {
            fileId,
            mimeType: exportMime,
          },
          { responseType: 'stream' },
        );
        const filename = filenameForExport(meta.name, exportMime);
        return {
          stream: response.data,
          mimeType: exportMime,
          filename,
        };
      }

      const response = await driveClient.files.get(
        {
          fileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        { responseType: 'stream' },
      );

      return {
        stream: response.data,
        mimeType: meta.mimeType || 'application/octet-stream',
        filename: meta.name || 'file',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to stream file for preview: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Delete a file or folder from Google Drive
   * @param accessToken User's Google OAuth2 access token
   * @param fileId File or folder ID to delete
   * @returns Success status
   */
  async deleteFile(accessToken: string, fileId: string): Promise<boolean> {
    try {
      const driveClient = this.getDriveClient(accessToken);

      await driveClient.files.delete({
        fileId: fileId,
      } as any);

      this.logger.log(`Deleted file/folder: ${fileId}`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete file: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Share a file or folder with a user
   * @param accessToken User's Google OAuth2 access token
   * @param fileId File or folder ID
   * @param email Email address to share with
   * @param role Role: reader, commenter, writer, organizer
   * @returns Share metadata
   */
  async shareFile(
    accessToken: string,
    fileId: string,
    email: string,
    role: string = 'reader',
  ): Promise<any> {
    try {
      const driveClient = this.getDriveClient(accessToken);

      const response = await driveClient.permissions.create({
        fileId: fileId,
        requestBody: {
          role: role,
          type: 'user',
          emailAddress: email,
        },
        fields: 'id',
      } as any);

      this.logger.log(`Shared file ${fileId} with ${email} as ${role}`);
      return response.data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to share file: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Drive usage for org/workspace accounts: `storageQuota.limit` is often not meaningful.
   * Usage is computed as `usageInDrive` + `usageInDriveTrash` from the Drive About API.
   * The storage cap is stored separately and edited by the user in app settings.
   *
   * @returns Combined usage in bytes as a decimal string, or null if unavailable.
   */
  async getAboutStorageQuota(
    accessToken: string,
  ): Promise<{ usage: string } | null> {
    try {
      const driveClient = this.getDriveClient(accessToken);
      const res = await driveClient.about.get({
        fields: 'storageQuota(usageInDrive,usageInDriveTrash)',
      });
      const sq = res.data.storageQuota;
      if (!sq) {
        return null;
      }
      const toDec = (v: string | null | undefined) =>
        v != null && v !== '' ? v : '0';
      const usage = (
        BigInt(toDec(sq.usageInDrive)) + BigInt(toDec(sq.usageInDriveTrash))
      ).toString();
      return { usage };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to read Drive storage quota: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Sync group flashcard resources from Google Drive
   * @param accessToken User's Google OAuth2 access token
   * @param groupId Group ID
   * @param driveFolderId Google Drive folder ID
   * @returns Sync status
   */
  async syncGroupFlashcards(
    accessToken: string,
    groupId: string,
    driveFolderId: string,
  ): Promise<boolean> {
    this.logger.log(
      `Sync requested for group ${groupId} from Drive folder ${driveFolderId}`,
    );
    // TODO: Implement actual sync logic
    // 1. List files in driveFolderId using user's access token
    // 2. Parse flashcard content (CSV, JSON, etc.)
    // 3. Create/update flashcard records in database
    // 4. Link to group
    return true;
  }
}

function exportMimeForGoogleWorkspace(mimeType: string): string | null {
  switch (mimeType) {
    case 'application/vnd.google-apps.document':
      return 'application/pdf';
    case 'application/vnd.google-apps.spreadsheet':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'application/vnd.google-apps.presentation':
      return 'application/pdf';
    default:
      if (mimeType === 'application/vnd.google-apps.folder') {
        return null;
      }
      if (mimeType.startsWith('application/vnd.google-apps.')) {
        return 'application/pdf';
      }
      return null;
  }
}

function filenameForExport(baseName: string, exportMime: string): string {
  const stem = baseName.replace(/\.[^/.]+$/, '') || baseName;
  if (exportMime === 'application/pdf') {
    return `${stem}.pdf`;
  }
  if (
    exportMime ===
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return `${stem}.xlsx`;
  }
  return baseName;
}
