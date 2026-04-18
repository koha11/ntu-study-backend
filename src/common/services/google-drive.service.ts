import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private driveClient!: drive_v3.Drive;

  constructor(private configService: ConfigService) {
    this.initializeDriveClient();
  }

  private initializeDriveClient() {
    const apiKey = this.configService.get<string>('GOOGLE_DRIVE_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'Google Drive API key not configured. Drive operations will be unavailable.',
      );
      return;
    }

    try {
      this.driveClient = google.drive({
        version: 'v3',
        auth: apiKey,
      });
      this.logger.log('Google Drive client initialized');
    } catch (error) {
      this.logger.error(
        `Failed to initialize Google Drive client: ${error.message}`,
      );
    }
  }

  /**
   * Create a folder in Google Drive
   * @param folderName Name of the folder to create
   * @param parentFolderId Optional parent folder ID
   * @returns Folder metadata
   */
  async createFolder(
    folderName: string,
    parentFolderId?: string,
  ): Promise<any> {
    if (!this.driveClient) {
      this.logger.error('Google Drive client not initialized');
      return null;
    }

    try {
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined,
      };

      const response = await this.driveClient.files.create({
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
   * @param fileName Name of the file
   * @param fileContent File content (Buffer or Stream)
   * @param mimeType MIME type of the file
   * @param parentFolderId Optional parent folder ID
   * @returns File metadata
   */
  async uploadFile(
    fileName: string,
    fileContent: any,
    mimeType: string,
    parentFolderId?: string,
  ): Promise<any> {
    if (!this.driveClient) {
      this.logger.error('Google Drive client not initialized');
      return null;
    }

    try {
      const fileMetadata = {
        name: fileName,
        parents: parentFolderId ? [parentFolderId] : undefined,
      };

      const media = {
        mimeType: mimeType,
        body: fileContent,
      };

      const response = await this.driveClient.files.create({
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
   * @param folderId Folder ID to list
   * @param pageSize Number of files to return
   * @returns List of files
   */
  async listFiles(folderId: string, pageSize: number = 10): Promise<any[]> {
    if (!this.driveClient) {
      this.logger.error('Google Drive client not initialized');
      return [];
    }

    try {
      const query = `'${folderId}' in parents and trashed=false`;
      const response = await this.driveClient.files.list({
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
   * @param fileId File or folder ID to delete
   * @returns Success status
   */
  async deleteFile(fileId: string): Promise<boolean> {
    if (!this.driveClient) {
      this.logger.error('Google Drive client not initialized');
      return false;
    }

    try {
      await this.driveClient.files.delete({
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
   * @param fileId File or folder ID
   * @param email Email address to share with
   * @param role Role: reader, commenter, writer, organizer
   * @returns Share metadata
   */
  async shareFile(
    fileId: string,
    email: string,
    role: string = 'reader',
  ): Promise<any> {
    if (!this.driveClient) {
      this.logger.error('Google Drive client not initialized');
      return null;
    }

    try {
      const response = await this.driveClient.permissions.create({
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
   * Sync group flashcard resources from Google Drive (placeholder)
   * @param groupId Group ID
   * @param driveFolderId Google Drive folder ID
   * @returns Sync status
   */
  async syncGroupFlashcards(
    groupId: string,
    driveFolderId: string,
  ): Promise<boolean> {
    this.logger.log(
      `Sync requested for group ${groupId} from Drive folder ${driveFolderId}`,
    );
    // TODO: Implement actual sync logic
    // 1. List files in driveFolderId
    // 2. Parse flashcard content (CSV, JSON, etc.)
    // 3. Create/update flashcard records in database
    // 4. Link to group
    return true;
  }
}
