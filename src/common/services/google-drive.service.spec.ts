import { Readable } from 'node:stream';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleDriveService } from './google-drive.service';

/**
 * Tests mock the private client-factory methods on the service instance,
 * avoiding a hard dependency on live Google API credentials.
 */
describe('GoogleDriveService', () => {
  let service: GoogleDriveService;
  const accessToken = 'fake-access-token';

  // Drive client mock factories
  const mockFilesCreate = vi.fn();
  const mockFilesList = vi.fn();
  const mockFilesGetRaw = vi.fn();
  const mockFilesDelete = vi.fn();
  const mockFilesExport = vi.fn();
  const mockPermissionsCreate = vi.fn();
  const mockAboutGet = vi.fn();
  const mockActivityQuery = vi.fn();

  const makeDriveClient = () => ({
    files: {
      create: mockFilesCreate,
      list: mockFilesList,
      get: mockFilesGetRaw,
      delete: mockFilesDelete,
      export: mockFilesExport,
    },
    permissions: { create: mockPermissionsCreate },
    about: { get: mockAboutGet },
  });

  const makeDriveActivityClient = () => ({
    activity: { query: mockActivityQuery },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GoogleDriveService();
    // Override private client factories via casting
    vi.spyOn(service as any, 'getDriveClient').mockReturnValue(
      makeDriveClient(),
    );
    vi.spyOn(service as any, 'getDriveActivityClient').mockReturnValue(
      makeDriveActivityClient(),
    );
  });

  // -------------------------------------------------------------------------
  // createFolder
  // -------------------------------------------------------------------------
  describe('createFolder', () => {
    it('returns folder data on success', async () => {
      mockFilesCreate.mockResolvedValue({
        data: {
          id: 'folder-id',
          name: 'MyFolder',
          webViewLink: 'https://drive.google.com/f',
        },
      });

      const result = await service.createFolder(accessToken, 'MyFolder');

      expect(result.id).toBe('folder-id');
    });

    it('returns null when the API throws', async () => {
      mockFilesCreate.mockRejectedValue(new Error('API error'));

      const result = await service.createFolder(accessToken, 'Bad');

      expect(result).toBeNull();
    });

    it('passes parentFolderId when provided', async () => {
      mockFilesCreate.mockResolvedValue({ data: { id: 'f1' } });

      await service.createFolder(accessToken, 'Child', 'parent-id');

      expect(mockFilesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({ parents: ['parent-id'] }),
        }),
      );
    });

    it('omits parents when no parentFolderId', async () => {
      mockFilesCreate.mockResolvedValue({ data: { id: 'f2' } });

      await service.createFolder(accessToken, 'Root');

      const call = mockFilesCreate.mock.calls[0][0];
      expect(call.requestBody.parents).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // listFiles
  // -------------------------------------------------------------------------
  describe('listFiles', () => {
    it('returns file array on success', async () => {
      mockFilesList.mockResolvedValue({
        data: { files: [{ id: 'f1', name: 'test.pdf' }] },
      });

      const result = await service.listFiles(accessToken, 'folder-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('f1');
    });

    it('returns empty array when no files key in response', async () => {
      mockFilesList.mockResolvedValue({ data: {} });

      const result = await service.listFiles(accessToken, 'folder-1');

      expect(result).toEqual([]);
    });

    it('returns empty array when API throws', async () => {
      mockFilesList.mockRejectedValue(new Error('API error'));

      const result = await service.listFiles(accessToken, 'folder-1');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // uploadFile
  // -------------------------------------------------------------------------
  describe('uploadFile', () => {
    it('uploads a Buffer and returns file metadata', async () => {
      mockFilesCreate.mockResolvedValue({
        data: { id: 'uploaded-id', name: 'file.txt' },
      });

      const result = await service.uploadFile(
        accessToken,
        'file.txt',
        Buffer.from('content'),
        'text/plain',
      );

      expect(result.id).toBe('uploaded-id');
    });

    it('uploads a Readable stream', async () => {
      mockFilesCreate.mockResolvedValue({ data: { id: 'stream-id' } });
      const stream = Readable.from(['hello']);

      const result = await service.uploadFile(
        accessToken,
        'file.txt',
        stream,
        'text/plain',
      );

      expect(result.id).toBe('stream-id');
    });

    it('returns null on API error', async () => {
      mockFilesCreate.mockRejectedValue(new Error('Upload failed'));

      const result = await service.uploadFile(
        accessToken,
        'file.txt',
        Buffer.from('x'),
        'text/plain',
      );

      expect(result).toBeNull();
    });

    it('passes parentFolderId when provided', async () => {
      mockFilesCreate.mockResolvedValue({ data: { id: 'p-file' } });

      await service.uploadFile(
        accessToken,
        'file.txt',
        Buffer.from('data'),
        'text/plain',
        'parent-folder-id',
      );

      expect(mockFilesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            parents: ['parent-folder-id'],
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getFileMetadata
  // -------------------------------------------------------------------------
  describe('getFileMetadata', () => {
    it('returns metadata on success', async () => {
      mockFilesGetRaw.mockResolvedValue({
        data: {
          id: 'file-1',
          name: 'doc.pdf',
          mimeType: 'application/pdf',
          parents: ['folder-1'],
        },
      });

      const result = await service.getFileMetadata(accessToken, 'file-1');

      expect(result?.id).toBe('file-1');
      expect(result?.parents).toEqual(['folder-1']);
    });

    it('returns null when API throws', async () => {
      mockFilesGetRaw.mockRejectedValue(new Error('Not found'));

      const result = await service.getFileMetadata(accessToken, 'bad-id');

      expect(result).toBeNull();
    });

    it('returns empty parents array when none in response', async () => {
      mockFilesGetRaw.mockResolvedValue({
        data: { id: 'f1', name: 'f', mimeType: 'text/plain' },
      });

      const result = await service.getFileMetadata(accessToken, 'f1');

      expect(result?.parents).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // isResourceUnderFolder
  // -------------------------------------------------------------------------
  describe('isResourceUnderFolder', () => {
    it('returns true immediately when resourceId equals rootFolderId', async () => {
      const result = await service.isResourceUnderFolder(
        accessToken,
        'root-id',
        'root-id',
      );
      expect(result).toBe(true);
      expect(mockFilesGetRaw).not.toHaveBeenCalled();
    });

    it('returns true when file is directly inside root folder', async () => {
      mockFilesGetRaw.mockResolvedValue({
        data: {
          id: 'file-1',
          name: 'f',
          mimeType: 'text/plain',
          parents: ['root-id'],
        },
      });

      const result = await service.isResourceUnderFolder(
        accessToken,
        'root-id',
        'file-1',
      );
      expect(result).toBe(true);
    });

    it('returns true when file is nested two levels under root', async () => {
      // File → Subfolder → Root
      mockFilesGetRaw
        .mockResolvedValueOnce({
          data: {
            id: 'file-1',
            name: 'f',
            mimeType: 'text/plain',
            parents: ['subfolder-1'],
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: 'subfolder-1',
            name: 'sub',
            mimeType: 'application/vnd.google-apps.folder',
            parents: ['root-id'],
          },
        });

      const result = await service.isResourceUnderFolder(
        accessToken,
        'root-id',
        'file-1',
      );
      expect(result).toBe(true);
    });

    it('returns false when file has no parents', async () => {
      mockFilesGetRaw.mockResolvedValue({
        data: { id: 'file-1', name: 'f', mimeType: 'text/plain', parents: [] },
      });

      const result = await service.isResourceUnderFolder(
        accessToken,
        'root-id',
        'file-1',
      );
      expect(result).toBe(false);
    });

    it('returns false when getFileMetadata returns null', async () => {
      mockFilesGetRaw.mockRejectedValue(new Error('not found'));

      const result = await service.isResourceUnderFolder(
        accessToken,
        'root-id',
        'file-1',
      );
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // toUploadReadable — unsupported type (line 277)
  // -------------------------------------------------------------------------
  describe('toUploadReadable — unsupported type', () => {
    it('calling uploadFile with an unsupported body returns null (TypeError caught internally)', async () => {
      // toUploadReadable throws TypeError internally; uploadFile catches it and returns null
      const result = await service.uploadFile(
        accessToken,
        'file.txt',
        {} as unknown as Buffer,
        'text/plain',
      );
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // deleteFile
  // -------------------------------------------------------------------------
  describe('deleteFile', () => {
    it('returns true on success', async () => {
      mockFilesDelete.mockResolvedValue({});

      const result = await service.deleteFile(accessToken, 'file-id');

      expect(result).toBe(true);
    });

    it('returns false on API error', async () => {
      mockFilesDelete.mockRejectedValue(new Error('Forbidden'));

      const result = await service.deleteFile(accessToken, 'file-id');

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // shareFile
  // -------------------------------------------------------------------------
  describe('shareFile', () => {
    it('calls permissions.create with correct arguments', async () => {
      mockPermissionsCreate.mockResolvedValue({ data: { id: 'perm-id' } });

      const result = await service.shareFile(
        accessToken,
        'file-1',
        'user@test.com',
        'writer',
      );

      expect(mockPermissionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'file-1',
          requestBody: expect.objectContaining({
            role: 'writer',
            emailAddress: 'user@test.com',
          }),
        }),
      );
      expect(result.id).toBe('perm-id');
    });

    it('defaults to reader role', async () => {
      mockPermissionsCreate.mockResolvedValue({ data: { id: 'p2' } });

      await service.shareFile(accessToken, 'file-1', 'user@test.com');

      expect(mockPermissionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({ role: 'reader' }),
        }),
      );
    });

    it('returns null on API error', async () => {
      mockPermissionsCreate.mockRejectedValue(new Error('Share failed'));

      const result = await service.shareFile(
        accessToken,
        'file-1',
        'user@test.com',
      );

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getAboutStorageQuota
  // -------------------------------------------------------------------------
  describe('getAboutStorageQuota', () => {
    it('returns usage sum of usageInDrive and usageInDriveTrash', async () => {
      mockAboutGet.mockResolvedValue({
        data: {
          storageQuota: { usageInDrive: '1000', usageInDriveTrash: '200' },
        },
      });

      const result = await service.getAboutStorageQuota(accessToken);

      expect(result?.usage).toBe('1200');
    });

    it('treats null usage values as 0', async () => {
      mockAboutGet.mockResolvedValue({
        data: { storageQuota: { usageInDrive: null, usageInDriveTrash: null } },
      });

      const result = await service.getAboutStorageQuota(accessToken);

      expect(result?.usage).toBe('0');
    });

    it('returns null when storageQuota is missing', async () => {
      mockAboutGet.mockResolvedValue({ data: {} });

      const result = await service.getAboutStorageQuota(accessToken);

      expect(result).toBeNull();
    });

    it('returns null on API error', async () => {
      mockAboutGet.mockRejectedValue(new Error('API error'));

      const result = await service.getAboutStorageQuota(accessToken);

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // syncGroupFlashcards
  // -------------------------------------------------------------------------
  describe('syncGroupFlashcards', () => {
    it('returns true (stub)', async () => {
      const result = await service.syncGroupFlashcards(
        accessToken,
        'group-1',
        'folder-1',
      );
      expect(result).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getFileContentStreamForPreview
  // -------------------------------------------------------------------------
  describe('getFileContentStreamForPreview', () => {
    it('returns null when file metadata is not found (API error)', async () => {
      mockFilesGetRaw.mockRejectedValue(new Error('not found'));

      const result = await service.getFileContentStreamForPreview(
        accessToken,
        'bad-id',
      );

      expect(result).toBeNull();
    });

    it('returns null for folder mime type', async () => {
      mockFilesGetRaw.mockResolvedValue({
        data: {
          id: 'f1',
          name: 'folder',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [],
        },
      });

      const result = await service.getFileContentStreamForPreview(
        accessToken,
        'f1',
      );

      expect(result).toBeNull();
    });

    it('exports Google Docs as PDF stream', async () => {
      mockFilesGetRaw.mockResolvedValue({
        data: {
          id: 'doc1',
          name: 'MyDoc',
          mimeType: 'application/vnd.google-apps.document',
          parents: [],
        },
      });
      const fakeStream = Readable.from(['pdf bytes']);
      mockFilesExport.mockResolvedValue({ data: fakeStream });

      const result = await service.getFileContentStreamForPreview(
        accessToken,
        'doc1',
      );

      expect(result?.mimeType).toBe('application/pdf');
      expect(result?.filename).toBe('MyDoc.pdf');
    });

    it('exports Google Slides (presentation) as PDF stream', async () => {
      mockFilesGetRaw.mockResolvedValue({
        data: {
          id: 'slide1',
          name: 'MyPresentation',
          mimeType: 'application/vnd.google-apps.presentation',
          parents: [],
        },
      });
      const fakeStream = Readable.from(['slide bytes']);
      mockFilesExport.mockResolvedValue({ data: fakeStream });

      const result = await service.getFileContentStreamForPreview(
        accessToken,
        'slide1',
      );

      expect(result?.mimeType).toBe('application/pdf');
      expect(result?.filename).toBe('MyPresentation.pdf');
    });

    it('exports generic Google Workspace type as PDF', async () => {
      mockFilesGetRaw.mockResolvedValue({
        data: {
          id: 'form1',
          name: 'MyForm',
          mimeType: 'application/vnd.google-apps.form',
          parents: [],
        },
      });
      const fakeStream = Readable.from(['form bytes']);
      mockFilesExport.mockResolvedValue({ data: fakeStream });

      const result = await service.getFileContentStreamForPreview(
        accessToken,
        'form1',
      );

      expect(result?.mimeType).toBe('application/pdf');
    });

    it('exports Google Sheets as xlsx', async () => {
      mockFilesGetRaw.mockResolvedValue({
        data: {
          id: 'sheet1',
          name: 'Sheet',
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [],
        },
      });
      const fakeStream = Readable.from(['xlsx bytes']);
      mockFilesExport.mockResolvedValue({ data: fakeStream });

      const result = await service.getFileContentStreamForPreview(
        accessToken,
        'sheet1',
      );

      expect(result?.filename).toBe('Sheet.xlsx');
    });

    it('streams regular files via alt=media', async () => {
      // First call: getFileMetadata (uses mockFilesGetRaw)
      mockFilesGetRaw
        .mockResolvedValueOnce({
          data: {
            id: 'img1',
            name: 'photo.png',
            mimeType: 'image/png',
            parents: [],
          },
        })
        // Second call: files.get({ alt: 'media' })
        .mockResolvedValueOnce({ data: Readable.from(['img bytes']) });

      const result = await service.getFileContentStreamForPreview(
        accessToken,
        'img1',
      );

      expect(result?.mimeType).toBe('image/png');
      expect(result?.filename).toBe('photo.png');
    });

    it('returns null when the export/stream API call throws', async () => {
      mockFilesGetRaw.mockResolvedValue({
        data: {
          id: 'f1',
          name: 'file.pdf',
          mimeType: 'application/pdf',
          parents: [],
        },
      });
      mockFilesGetRaw.mockRejectedValueOnce(new Error('stream error'));

      // The first mockFilesGetRaw resolves (metadata), second rejects (stream) — but
      // since both use the same mock function, arrange via sequential ordering:
      const getDriveClientSpy = vi.spyOn(service as any, 'getDriveClient');
      getDriveClientSpy.mockReturnValue({
        ...makeDriveClient(),
        files: {
          ...makeDriveClient().files,
          get: vi
            .fn()
            .mockResolvedValueOnce({
              data: {
                id: 'f1',
                name: 'file.pdf',
                mimeType: 'application/pdf',
                parents: [],
              },
            })
            .mockRejectedValueOnce(new Error('stream error')),
        },
      });

      const result = await service.getFileContentStreamForPreview(
        accessToken,
        'f1',
      );

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // queryFolderActivity
  // -------------------------------------------------------------------------
  describe('queryFolderActivity', () => {
    it('returns empty items when API returns no activities', async () => {
      mockActivityQuery.mockResolvedValue({ data: {} });

      const result = await service.queryFolderActivity(accessToken, 'folder-1');

      expect(result?.items).toEqual([]);
    });

    it('returns null when API throws', async () => {
      mockActivityQuery.mockRejectedValue(new Error('Quota exceeded'));

      const result = await service.queryFolderActivity(accessToken, 'folder-1');

      expect(result).toBeNull();
    });

    it('passes pageToken when provided', async () => {
      mockActivityQuery.mockResolvedValue({
        data: { nextPageToken: 'next-token-123' },
      });

      const result = await service.queryFolderActivity(
        accessToken,
        'folder-1',
        {
          pageToken: 'prev-token',
        },
      );

      expect(mockActivityQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({ pageToken: 'prev-token' }),
        }),
      );
      expect(result?.nextPageToken).toBe('next-token-123');
    });

    it('clamps pageSize to 50 when above max', async () => {
      mockActivityQuery.mockResolvedValue({ data: {} });

      await service.queryFolderActivity(accessToken, 'folder-1', {
        pageSize: 100,
      });

      expect(mockActivityQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({ pageSize: 50 }),
        }),
      );
    });

    it('clamps pageSize to 1 when below min', async () => {
      mockActivityQuery.mockResolvedValue({ data: {} });

      await service.queryFolderActivity(accessToken, 'folder-1', {
        pageSize: 0,
      });

      expect(mockActivityQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({ pageSize: 1 }),
        }),
      );
    });

    it('enriches actor display names when People API resolves', async () => {
      // Spy on getPeopleClient too
      const mockPeopleGet = vi.fn().mockResolvedValue({
        data: {
          names: [{ metadata: { primary: true }, displayName: 'Alice Smith' }],
          photos: [{ metadata: { primary: true }, url: 'https://photo.url' }],
        },
      });
      vi.spyOn(service as any, 'getPeopleClient').mockReturnValue({
        people: { get: mockPeopleGet },
      });

      mockActivityQuery.mockResolvedValue({
        data: {
          activities: [
            {
              primaryActionDetail: { create: {} },
              actors: [{ user: { knownUser: { personName: 'people/user1' } } }],
              targets: [
                { driveItem: { name: 'items/file1', title: 'doc.pdf' } },
              ],
              timestamp: '2026-01-01T00:00:00Z',
            },
          ],
        },
      });

      const result = await service.queryFolderActivity(accessToken, 'folder-1');

      expect(result?.items[0].actorDisplayName).toBe('Alice Smith');
      expect(result?.items[0].actorPhotoUrl).toBe('https://photo.url');
    });

    it('handles People API failure gracefully (null actor profile)', async () => {
      vi.spyOn(service as any, 'getPeopleClient').mockReturnValue({
        people: {
          get: vi.fn().mockRejectedValue(new Error('People API error')),
        },
      });

      mockActivityQuery.mockResolvedValue({
        data: {
          activities: [
            {
              primaryActionDetail: { edit: {} },
              actors: [{ user: { knownUser: { personName: 'people/user2' } } }],
              targets: [{ driveItem: { name: 'items/f2', title: 'f.pdf' } }],
              timestamp: '2026-01-01T00:00:00Z',
            },
          ],
        },
      });

      const result = await service.queryFolderActivity(accessToken, 'folder-1');

      expect(result?.items[0].actorDisplayName).toBeUndefined();
    });
  });
});
