import { Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export type LearningContentPackageType = 'SCORM_1_2' | 'SCORM_2004' | 'XAPI';

export interface LearningContentStorageMeta {
  tenantId: string;
  packageId: string;
  packageType: LearningContentPackageType;
  originalFileName: string;
  mimeType: string;
}

export interface LearningContentStorageSaveResult {
  fileUrl: string;
  checksum: string;
  sizeBytes: number;
  mimeType: string;
  originalFileName: string;
}

/**
 * Raised for any rejected upload (too large, wrong type, bad reference on read).
 * Deliberately not an HTTP exception — this service has no framework dependency,
 * so the caller (controller) maps it onto the appropriate HTTP status.
 */
export class LearningContentStorageValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'LearningContentStorageValidationError';
    this.code = code;
  }
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Default 200MB ceiling; overridable per-deployment without a code change. */
export const MAX_LEARNING_CONTENT_UPLOAD_BYTES = parsePositiveIntEnv('LEARNING_CONTENT_MAX_UPLOAD_BYTES', 200 * 1024 * 1024);

const ZIP_MIME_TYPES = new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream']);
const XAPI_EXTRA_MIME_TYPES = new Set(['application/json', 'text/html', 'application/xml', 'text/xml']);
const XAPI_EXTRA_EXTENSIONS = new Set(['.json', '.html', '.htm', '.xml']);

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx).toLowerCase();
}

function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'upload.bin';
}

/**
 * Validates a candidate upload against the package's declared type, fail-closed.
 * SCORM (1.2 / 2004) packages must be a zip archive; xAPI packages may be a zip
 * (Tin Can bundle) or a plain content artifact (json/html/xml). Exported standalone
 * so it can be exercised directly in tests without touching disk.
 */
export function validateLearningContentUpload(meta: {
  packageType: LearningContentPackageType;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
}): void {
  if (meta.sizeBytes <= 0) {
    throw new LearningContentStorageValidationError('Uploaded file is empty.', 'EMPTY_FILE');
  }
  if (meta.sizeBytes > MAX_LEARNING_CONTENT_UPLOAD_BYTES) {
    throw new LearningContentStorageValidationError(
      `Uploaded file (${meta.sizeBytes} bytes) exceeds the maximum allowed size of ${MAX_LEARNING_CONTENT_UPLOAD_BYTES} bytes.`,
      'FILE_TOO_LARGE',
    );
  }

  const ext = extensionOf(meta.originalFileName);
  const mime = meta.mimeType.toLowerCase();

  if (meta.packageType === 'SCORM_1_2' || meta.packageType === 'SCORM_2004') {
    if (ext !== '.zip') {
      throw new LearningContentStorageValidationError(
        `SCORM content packages must be uploaded as a .zip file (got "${ext || 'no extension'}").`,
        'INVALID_EXTENSION',
      );
    }
    if (!ZIP_MIME_TYPES.has(mime)) {
      throw new LearningContentStorageValidationError(
        `SCORM content packages must be a zip archive (got content type "${meta.mimeType}").`,
        'INVALID_MIME_TYPE',
      );
    }
    return;
  }

  // XAPI
  const allowedExt = ext === '.zip' || XAPI_EXTRA_EXTENSIONS.has(ext);
  if (!allowedExt) {
    throw new LearningContentStorageValidationError(
      `xAPI content packages must be a .zip, .json, .html, or .xml file (got "${ext || 'no extension'}").`,
      'INVALID_EXTENSION',
    );
  }
  const allowedMime = ZIP_MIME_TYPES.has(mime) || XAPI_EXTRA_MIME_TYPES.has(mime);
  if (!allowedMime) {
    throw new LearningContentStorageValidationError(
      `xAPI content packages have an unsupported content type "${meta.mimeType}".`,
      'INVALID_MIME_TYPE',
    );
  }
}

/**
 * Storage adapter contract for learning content package binaries.
 *
 * Declared as an abstract class rather than a TS `interface` so it doubles as a
 * NestJS DI token: swapping the local-disk implementation for an S3/Blob-backed
 * one is a one-line provider change in learning.module.ts (`useClass` / `useFactory`),
 * not a rewrite of the controller or command handlers that depend on it.
 */
export abstract class LearningContentStorageService {
  abstract save(buffer: Buffer, meta: LearningContentStorageMeta): Promise<LearningContentStorageSaveResult>;
  abstract read(fileUrl: string): Promise<Buffer>;
}

const FILE_URL_PREFIX = 'local://learning-content/';

/**
 * Local-disk-backed implementation. Files are stored under
 * `<baseDir>/<tenantId>/<packageId>/<storedFileName>`, keyed by a `local://...`
 * fileUrl so a future remote adapter's fileUrls (e.g. `s3://...`) are trivially
 * distinguishable and this adapter never tries to resolve someone else's key.
 */
@Injectable()
export class LocalDiskLearningContentStorageService extends LearningContentStorageService {
  private readonly baseDir: string;

  constructor(@Optional() baseDir?: string) {
    super();
    this.baseDir = path.resolve(
      baseDir ?? process.env.LEARNING_CONTENT_STORAGE_DIR ?? path.join(process.cwd(), 'uploads', 'learning-content'),
    );
  }

  async save(buffer: Buffer, meta: LearningContentStorageMeta): Promise<LearningContentStorageSaveResult> {
    validateLearningContentUpload({
      packageType: meta.packageType,
      originalFileName: meta.originalFileName,
      mimeType: meta.mimeType,
      sizeBytes: buffer.length,
    });

    const safeName = sanitizeFileName(meta.originalFileName);
    const storedName = `${Date.now()}-${randomUUID()}-${safeName}`;
    const relativeKey = path.posix.join(meta.tenantId, meta.packageId, storedName);
    const absoluteDir = path.join(this.baseDir, meta.tenantId, meta.packageId);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(absoluteDir, storedName), buffer);

    return {
      fileUrl: `${FILE_URL_PREFIX}${relativeKey}`,
      checksum: createHash('sha256').update(buffer).digest('hex'),
      sizeBytes: buffer.length,
      mimeType: meta.mimeType,
      originalFileName: meta.originalFileName,
    };
  }

  async read(fileUrl: string): Promise<Buffer> {
    const relativeKey = this.parseFileUrl(fileUrl);
    const absolutePath = path.resolve(this.baseDir, relativeKey);
    if (absolutePath !== this.baseDir && !absolutePath.startsWith(this.baseDir + path.sep)) {
      throw new LearningContentStorageValidationError('Invalid file reference.', 'INVALID_FILE_URL');
    }
    if (!existsSync(absolutePath)) {
      throw new LearningContentStorageValidationError('Stored content package file was not found.', 'FILE_NOT_FOUND');
    }
    return readFile(absolutePath);
  }

  private parseFileUrl(fileUrl: string): string {
    if (!fileUrl.startsWith(FILE_URL_PREFIX)) {
      throw new LearningContentStorageValidationError(
        `Unsupported file reference "${fileUrl}" for local disk storage.`,
        'UNSUPPORTED_FILE_URL',
      );
    }
    const relative = fileUrl.slice(FILE_URL_PREFIX.length);
    const normalized = path.posix.normalize(relative);
    if (normalized.startsWith('..') || path.posix.isAbsolute(normalized)) {
      throw new LearningContentStorageValidationError('Invalid file reference.', 'INVALID_FILE_URL');
    }
    return normalized;
  }
}
