import { Injectable, Logger } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

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
    fileContent: any,
    mimeType: string,
    parentFolderId?: string,
  ): Promise<any> {
    try {
      const driveClient = this.getDriveClient(accessToken);

      const fileMetadata = {
        name: fileName,
        parents: parentFolderId ? [parentFolderId] : undefined,
      };

      const media = {
        mimeType: mimeType,
        body: fileContent,
      };

      const response = await driveClient.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
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
        fields: 'files(id, name, mimeType, webViewLink)',
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
