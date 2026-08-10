import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { AppError } from '../middleware/errorHandler';
import { googleOAuth } from './googleOAuth';

export interface DriveFileInput {
  filename: string;
  buffer: Buffer;
  mimeType: string;
}

export interface DriveUploadedFile {
  name: string;
  driveFileId: string | null;
  driveUrl: string | null;
  localUrl: string | null;
}

export interface DriveUploadResult {
  folderUrl: string;
  files: DriveUploadedFile[];
  folderId?: string | null;
  folderPath?: string;
}

const ROOT_FOLDER_NAME = 'HR Documents';
const ACCEPTANCE_ROOT_FOLDER_NAME = 'OneBridge HRMS';
const ACCEPTANCE_EMPLOYEES_FOLDER_NAME = 'Employees';

/**
 * Uploads run against the My Drive of the company Google account connected via
 * OAuth (see googleOAuth.ts). All files/folders are created under the root
 * folder (ROOT_FOLDER_NAME / ACCEPTANCE_ROOT_FOLDER_NAME) unless
 * GOOGLE_DRIVE_ROOT_FOLDER_ID is configured.
 */

const sanitizeName = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9._\-\s]/g, '').replace(/\s+/g, ' ').trim();
};

class DriveService {
  private drive: any = null;

  public get isConfigured(): boolean {
    // Drive is only usable once OAuth credentials exist AND a company Google
    // account has been connected. If credentials are set but no account is
    // connected yet, uploads throw a clear error instead of silently falling
    // back to local storage.
    return googleOAuth.isConfigured && googleOAuth.isConnectedFlag;
  }

  /**
   * Drive API parameters shared across list/create/update calls. Everything is
   * stored in the connected account's My Drive (`spaces: 'drive'`).
   * `supportsAllDrives: true` keeps the API safe when the connected account is
   * a member of any shared drive.
   */
  private sharedDriveParams(): {
    supportsAllDrives: boolean;
    spaces?: string;
  } {
    return { supportsAllDrives: true, spaces: 'drive' };
  }

  private async getDrive(): Promise<any> {
    if (this.drive) return this.drive;

    const auth = await googleOAuth.getAuthClient();
    this.drive = google.drive({ version: 'v3', auth });
    return this.drive;
  }

  /**
   * Returns the Drive folder id that acts as the root for all uploads.
   * When GOOGLE_DRIVE_ROOT_FOLDER_ID is configured it is used directly
   * (e.g. a folder inside the connected account's My Drive), otherwise the
   * named root folder is created in the connected account's My Drive.
   */
  private async rootFolderId(drive: any, folderName: string): Promise<string> {
    const configured = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (configured) return configured;
    return this.ensureFolder(drive, folderName, null);
  }

  private async ensureFolder(drive: any, name: string, parentId: string | null): Promise<string> {
    const escaped = name.replace(/'/g, "\\'");
    const q = `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ''}`;
    const existing = await drive.files.list({
      q,
      fields: 'files(id,name)',
      ...this.sharedDriveParams(),
    });
    if (existing.data.files && existing.data.files.length > 0) {
      return existing.data.files[0].id;
    }

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : [],
      },
      fields: 'id,name',
      ...this.sharedDriveParams(),
    });
    return created.data.id;
  }

  private async uploadToDrive(
    drive: any,
    buffer: Buffer,
    filename: string,
    mimeType: string,
    folderId: string
  ): Promise<{ driveFileId: string; driveUrl: string }> {
    const escaped = filename.replace(/'/g, "\\'");
    const existing = await drive.files.list({
      q: `name='${escaped}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id,name)',
      ...this.sharedDriveParams(),
    });

    const media = { mimeType, body: Readable.from(buffer) };
    let res: any;
    if (existing.data.files && existing.data.files.length > 0) {
      // Replace the existing file with the same name instead of creating a duplicate.
      res = await drive.files.update({
        fileId: existing.data.files[0].id,
        media,
        fields: 'id,name,webViewLink',
        supportsAllDrives: true,
      });
    } else {
      res = await drive.files.create({
        requestBody: {
          name: filename,
          mimeType,
          parents: [folderId],
        },
        media,
        fields: 'id,name,webViewLink',
        ...this.sharedDriveParams(),
      });
    }

    return {
      driveFileId: res.data.id,
      driveUrl: res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`,
    };
  }

  /**
   * Writes a file to local storage, tolerating files that are momentarily
   * locked (e.g. still open in Microsoft Word, or being scanned). When the
   * target cannot be written after a few short retries, the file is stored
   * under a unique name so the request still succeeds and the returned URL
   * resolves to the actual file.
   */
  private writeLocalFile(dir: string, filename: string, buffer: Buffer): string {
    const preferred = path.join(dir, filename);
    const isLock = (e: any) => !!e && (e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'EACCES');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.writeFileSync(preferred, buffer);
        return filename;
      } catch (err: any) {
        if (!isLock(err)) throw err;
        if (attempt < 2) {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
        }
      }
    }

    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    for (let i = 0; i < 25; i++) {
      const uniqueName = `${base}_${Date.now()}_${i}${ext}`;
      try {
        fs.writeFileSync(path.join(dir, uniqueName), buffer);
        return uniqueName;
      } catch (err2: any) {
        if (!isLock(err2)) throw err2;
      }
    }
    throw new Error(`Unable to write ${filename}: target remains locked`);
  }

  private fallbackToLocal(folderKey: string, files: DriveFileInput[]): DriveUploadResult {
    const baseDir = path.join(process.cwd(), 'documents', 'drive');
    const dir = path.join(baseDir, folderKey);
    fs.mkdirSync(dir, { recursive: true });

    const uploaded: DriveUploadedFile[] = files.map((f) => {
      const safeName = sanitizeName(f.filename).replace(/\s+/g, '_') || `file_${Date.now()}`;
      const safe = this.writeLocalFile(dir, safeName, f.buffer);
      return {
        name: f.filename,
        driveFileId: null,
        driveUrl: null,
        localUrl: `/documents/drive/${folderKey.replace(/\\/g, '/')}/${encodeURIComponent(safe)}`,
      };
    });

    return {
      folderUrl: `/documents/drive/${folderKey.replace(/\\/g, '/')}`,
      files: uploaded,
    };
  }

  /**
   * Writes a single acceptance file to local storage and returns its local URL
   * entry. Used for full local fallback and for per-file fallback when a Drive
   * upload fails (e.g. quota exceeded or the connected account lacks access).
   */
  private localAcceptanceFileEntry(
    folderPath: string,
    safeFolder: string,
    f: DriveFileInput & { subFolder?: string }
  ): DriveUploadedFile {
    const baseDir = path.join(process.cwd(), 'documents', 'drive', ACCEPTANCE_ROOT_FOLDER_NAME, ACCEPTANCE_EMPLOYEES_FOLDER_NAME);
    const dir = path.join(baseDir, safeFolder);
    const sub = f.subFolder ? sanitizeName(f.subFolder) : '';
    const target = sub ? path.join(dir, sub) : dir;
    fs.mkdirSync(target, { recursive: true });
    const safeName = sanitizeName(f.filename).replace(/\s+/g, '_') || `file_${Date.now()}`;
    const safe = this.writeLocalFile(target, safeName, f.buffer);
    const rel = `${folderPath.replace(/\\/g, '/')}${sub ? '/' + sub : ''}/${encodeURIComponent(safe)}`;
    return {
      name: f.filename,
      driveFileId: null,
      driveUrl: null,
      localUrl: `/documents/drive/${rel}`,
    };
  }

  /**
   * Fallback storage used when Google Drive is not configured or the upload
   * fails (e.g. quota exceeded or the connected account lacks access). Files
   * are written to `documents/drive/...` and served back through the
   * /documents static route.
   */
  private fallbackAcceptanceToLocal(
    folderPath: string,
    safeFolder: string,
    files: Array<DriveFileInput & { subFolder?: string }>
  ): DriveUploadResult {
    const uploaded: DriveUploadedFile[] = files.map((f) => this.localAcceptanceFileEntry(folderPath, safeFolder, f));

    return {
      folderUrl: `/documents/drive/${folderPath.replace(/\\/g, '/')}`,
      folderId: null,
      folderPath,
      files: uploaded,
    };
  }

  /**
   * Renames the employee folder (e.g. from an offer-based folder to the
   * generated employee ID once the employee joins).
   *
   * In local fallback mode the directory is renamed on disk and the new local
   * base path is returned so document URLs can be updated.
   */
  public async renameEmployeeFolder(
    currentFolder: string,
    year: string,
    newFolderName: string
  ): Promise<{ folderUrl: string; localBase?: string }> {
    const safeYear = sanitizeName(year) || String(new Date().getFullYear());
    const safeOld = sanitizeName(currentFolder);
    const safeNew = sanitizeName(newFolderName);

    if (!this.isConfigured) {
      const baseDir = path.join(process.cwd(), 'documents', 'drive', ROOT_FOLDER_NAME, safeYear);
      const oldDir = path.join(baseDir, safeOld);
      const newDir = path.join(baseDir, safeNew);
      if (fs.existsSync(oldDir) && oldDir !== newDir) {
        fs.renameSync(oldDir, newDir);
      }
      return {
        folderUrl: `/documents/drive/${ROOT_FOLDER_NAME}/${safeYear}/${encodeURIComponent(safeNew)}`,
        localBase: `/documents/drive/${ROOT_FOLDER_NAME}/${safeYear}/${encodeURIComponent(safeNew)}`,
      };
    }

    const drive = await this.getDrive();
    const rootId = await this.rootFolderId(drive, ROOT_FOLDER_NAME);
    const yearId = await this.ensureFolder(drive, safeYear, rootId);
    const folderRes = await drive.files.list({
      q: `name='${safeOld.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${yearId}' in parents and trashed=false`,
      fields: 'files(id,name)',
      ...this.sharedDriveParams(),
    });
    if (folderRes.data.files && folderRes.data.files.length > 0) {
      await drive.files.update({
        fileId: folderRes.data.files[0].id,
        requestBody: { name: safeNew },
        supportsAllDrives: true,
      });
      return { folderUrl: `https://drive.google.com/drive/folders/${folderRes.data.files[0].id}` };
    }
    return { folderUrl: `https://drive.google.com/drive/folders/${yearId}` };
  }

  /**
   * Uploads candidate onboarding documents to Google Drive under:
   *   HR Documents/<year>/<employeeFolder>/<filename>
   *
   * When Google Drive is not configured, files are stored locally under
   * `documents/drive/...` and local URLs are returned instead.
   */
  public async uploadCandidateDocuments(opts: {
    employeeFolder: string;
    year: string;
    files: DriveFileInput[];
  }): Promise<DriveUploadResult> {
    const safeYear = sanitizeName(opts.year) || String(new Date().getFullYear());
    const safeFolder = sanitizeName(opts.employeeFolder) || `EMP-${Date.now()}`;
    const folderKey = `${ROOT_FOLDER_NAME}/${safeYear}/${safeFolder}`;

    if (!this.isConfigured) {
      return this.fallbackToLocal(folderKey, opts.files);
    }

    const drive = await this.getDrive();
    const rootId = await this.rootFolderId(drive, ROOT_FOLDER_NAME);
    const yearId = await this.ensureFolder(drive, safeYear, rootId);
    const employeeId = await this.ensureFolder(drive, safeFolder, yearId);

    const uploaded: DriveUploadedFile[] = [];
    for (const f of opts.files) {
      const result = await this.uploadToDrive(drive, f.buffer, f.filename, f.mimeType, employeeId);
      uploaded.push({
        name: f.filename,
        driveFileId: result.driveFileId,
        driveUrl: result.driveUrl,
        localUrl: null,
      });
    }

    return {
      folderUrl: `https://drive.google.com/drive/folders/${employeeId}`,
      files: uploaded,
    };
  }

  /**
   * Uploads acceptance documents to Google Drive under the acceptance structure:
   *   OneBridge HRMS/Employees/EMP-XXXX - Candidate Name/{subFolder}/<filename>
   *
   * subFolder is optional; when provided the file is placed inside a matching
   * sub-folder (e.g. "Acceptance", "Personal Documents", "Certificates", "Signature").
   */
  public async uploadAcceptanceDocuments(opts: {
    candidateFolder: string;
    files: Array<DriveFileInput & { subFolder?: string }>;
    /**
     * When true, files that fail to upload to Drive are stored locally instead
     * of failing the whole request. Intended for convenience uploads (e.g. the
     * unsigned offer letter created when HR sends an offer) so a Drive quota or
     * permission error never blocks the action. Candidate Save/Submit must NOT
     * use this so they never report success while files are missing from Drive.
     */
    allowLocalFallback?: boolean;
  }): Promise<DriveUploadResult> {
    const safeFolder = sanitizeName(opts.candidateFolder) || `EMP-${Date.now()}`;
    const folderPath = `${ACCEPTANCE_ROOT_FOLDER_NAME}/${ACCEPTANCE_EMPLOYEES_FOLDER_NAME}/${safeFolder}`;

    // Local storage is used ONLY when Google Drive is not configured at all.
    // Once Drive is configured a failed upload must surface to the client so
    // the employee is never told they succeeded while Drive is empty.
    if (!this.isConfigured) {
      return this.fallbackAcceptanceToLocal(folderPath, safeFolder, opts.files);
    }

    const drive = await this.getDrive();
    const rootId = await this.rootFolderId(drive, ACCEPTANCE_ROOT_FOLDER_NAME);
    const employeesId = await this.ensureFolder(drive, ACCEPTANCE_EMPLOYEES_FOLDER_NAME, rootId);
    const employeeId = await this.ensureFolder(drive, safeFolder, employeesId);
    console.log(`[Drive Upload] Employee folder ready: "${safeFolder}" -> ${employeeId}`);

    const uploaded: DriveUploadedFile[] = [];
    const failed: { filename: string; error: any }[] = [];

    for (const f of opts.files) {
      let targetId = employeeId;
      try {
        if (f.subFolder) {
          targetId = await this.ensureFolder(drive, sanitizeName(f.subFolder), employeeId);
        }
        const result = await this.uploadToDrive(drive, f.buffer, f.filename, f.mimeType, targetId);
        uploaded.push({
          name: f.filename,
          driveFileId: result.driveFileId,
          driveUrl: result.driveUrl,
          localUrl: null,
        });
        console.log(
          `[Drive Upload] Employee: ${safeFolder} | Uploading: ${f.filename} | Folder ID: ${targetId} | Result: Success | Drive File ID: ${result.driveFileId}`
        );
      } catch (err: any) {
        console.error(`[Drive Upload] Employee: ${safeFolder} | File: ${f.filename} | Folder ID: ${targetId} | Result: Error`);
        console.error(`[Drive Upload] Error code: ${err?.code || err?.response?.status || 'N/A'} | Message: ${err?.response?.data?.error?.message || err?.message || String(err)}`);
        console.error(err?.stack || err);
        if (opts.allowLocalFallback) {
          const localEntry = this.localAcceptanceFileEntry(folderPath, safeFolder, f);
          uploaded.push(localEntry);
          console.warn(`[Drive Upload] "${f.filename}" uploaded to local storage instead of Drive: ${localEntry.localUrl}`);
        } else {
          failed.push({ filename: f.filename, error: err });
        }
      }
    }

    if (failed.length > 0) {
      const detail = failed
        .map((f) => `${f.filename}: ${f.error?.response?.data?.error?.message || f.error?.message || String(f.error)}`)
        .join('; ');
      throw new AppError(
        `Google Drive upload failed for ${failed.length} file(s): ${failed.map((f) => f.filename).join(', ')}. ${detail}`,
        500
      );
    }

    return {
      folderUrl: `https://drive.google.com/drive/folders/${employeeId}`,
      folderId: employeeId,
      folderPath,
      files: uploaded,
    };
  }

  /**
   * Renames a candidate folder under the acceptance structure:
   *   OneBridge HRMS/Employees/<currentFolder> -> OneBridge HRMS/Employees/<newFolderName>
   * Used when a candidate becomes an employee (EMP-XXXX -> OBIxxxx).
   */
  public async renameCandidateFolder(
    currentFolder: string,
    newFolderName: string
  ): Promise<{ folderUrl: string; localBase?: string }> {
    const safeOld = sanitizeName(currentFolder);
    const safeNew = sanitizeName(newFolderName);

    if (!this.isConfigured) {
      const baseDir = path.join(process.cwd(), 'documents', 'drive', ACCEPTANCE_ROOT_FOLDER_NAME, ACCEPTANCE_EMPLOYEES_FOLDER_NAME);
      const oldDir = path.join(baseDir, safeOld);
      const newDir = path.join(baseDir, safeNew);
      if (fs.existsSync(oldDir) && oldDir !== newDir) {
        fs.renameSync(oldDir, newDir);
      }
      const base = `/documents/drive/${ACCEPTANCE_ROOT_FOLDER_NAME}/${ACCEPTANCE_EMPLOYEES_FOLDER_NAME}/${encodeURIComponent(safeNew)}`;
      return { folderUrl: base, localBase: base };
    }

    const drive = await this.getDrive();
    const rootId = await this.rootFolderId(drive, ACCEPTANCE_ROOT_FOLDER_NAME);
    const employeesId = await this.ensureFolder(drive, ACCEPTANCE_EMPLOYEES_FOLDER_NAME, rootId);
    const folderRes = await drive.files.list({
      q: `name='${safeOld.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${employeesId}' in parents and trashed=false`,
      fields: 'files(id,name)',
      ...this.sharedDriveParams(),
    });
    if (folderRes.data.files && folderRes.data.files.length > 0) {
      await drive.files.update({
        fileId: folderRes.data.files[0].id,
        requestBody: { name: safeNew },
        supportsAllDrives: true,
      });
      return { folderUrl: `https://drive.google.com/drive/folders/${folderRes.data.files[0].id}` };
    }
    return { folderUrl: `https://drive.google.com/drive/folders/${employeesId}` };
  }
}

export const driveService = new DriveService();
export default driveService;
