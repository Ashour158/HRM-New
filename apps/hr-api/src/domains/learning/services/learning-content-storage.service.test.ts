import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import {
  LocalDiskLearningContentStorageService,
  LearningContentStorageValidationError,
  validateLearningContentUpload,
  MAX_LEARNING_CONTENT_UPLOAD_BYTES,
} from './learning-content-storage.service.js';

describe('validateLearningContentUpload', () => {
  it('rejects an empty file', () => {
    expect(() => validateLearningContentUpload({
      packageType: 'SCORM_2004', originalFileName: 'course.zip', mimeType: 'application/zip', sizeBytes: 0,
    })).toThrow(LearningContentStorageValidationError);
  });

  it('rejects a file larger than the configured maximum', () => {
    expect(() => validateLearningContentUpload({
      packageType: 'SCORM_2004',
      originalFileName: 'course.zip',
      mimeType: 'application/zip',
      sizeBytes: MAX_LEARNING_CONTENT_UPLOAD_BYTES + 1,
    })).toThrow(/exceeds the maximum allowed size/);
  });

  it('rejects a non-zip extension for SCORM 1.2/2004', () => {
    expect(() => validateLearningContentUpload({
      packageType: 'SCORM_1_2', originalFileName: 'notes.txt', mimeType: 'application/zip', sizeBytes: 10,
    })).toThrow(/must be uploaded as a \.zip file/);

    expect(() => validateLearningContentUpload({
      packageType: 'SCORM_2004', originalFileName: 'course.pdf', mimeType: 'application/zip', sizeBytes: 10,
    })).toThrow(/must be uploaded as a \.zip file/);
  });

  it('rejects a zip-extension SCORM upload with a nonsensical content type', () => {
    expect(() => validateLearningContentUpload({
      packageType: 'SCORM_2004', originalFileName: 'course.zip', mimeType: 'image/png', sizeBytes: 10,
    })).toThrow(/must be a zip archive/);
  });

  it('accepts a valid SCORM zip upload', () => {
    expect(() => validateLearningContentUpload({
      packageType: 'SCORM_2004', originalFileName: 'course.zip', mimeType: 'application/zip', sizeBytes: 10,
    })).not.toThrow();
  });

  it('accepts xAPI zip, json, and html uploads', () => {
    for (const [name, mime] of [
      ['bundle.zip', 'application/zip'],
      ['statement.json', 'application/json'],
      ['index.html', 'text/html'],
    ] as const) {
      expect(() => validateLearningContentUpload({
        packageType: 'XAPI', originalFileName: name, mimeType: mime, sizeBytes: 10,
      })).not.toThrow();
    }
  });

  it('rejects an xAPI upload with an unsupported extension', () => {
    expect(() => validateLearningContentUpload({
      packageType: 'XAPI', originalFileName: 'course.exe', mimeType: 'application/octet-stream', sizeBytes: 10,
    })).toThrow(/must be a \.zip, \.json, \.html, or \.xml file/);
  });
});

describe('LocalDiskLearningContentStorageService', () => {
  let baseDir: string;
  let service: LocalDiskLearningContentStorageService;

  beforeEach(() => {
    baseDir = mkdtempSync(path.join(tmpdir(), 'learning-content-storage-'));
    service = new LocalDiskLearningContentStorageService(baseDir);
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('saves a buffer and reads the exact same bytes back (round trip)', async () => {
    const buffer = Buffer.from('PK fake zip contents for round-trip testing');
    const saved = await service.save(buffer, {
      tenantId: 'tenant-1',
      packageId: 'package-1',
      packageType: 'SCORM_2004',
      originalFileName: 'course.zip',
      mimeType: 'application/zip',
    });

    expect(saved.fileUrl).toMatch(/^local:\/\/learning-content\/tenant-1\/package-1\//);
    expect(saved.sizeBytes).toBe(buffer.length);
    expect(saved.checksum).toHaveLength(64); // sha256 hex digest

    const readBack = await service.read(saved.fileUrl);
    expect(readBack.equals(buffer)).toBe(true);
  });

  it('produces a checksum that changes when the content changes', async () => {
    const meta = { tenantId: 't', packageId: 'p', packageType: 'SCORM_2004' as const, originalFileName: 'a.zip', mimeType: 'application/zip' };
    const first = await service.save(Buffer.from('content A'), meta);
    const second = await service.save(Buffer.from('content B'), meta);
    expect(first.checksum).not.toBe(second.checksum);
  });

  it('rejects saving a file that fails size/MIME validation before writing to disk', async () => {
    await expect(service.save(Buffer.from('not a zip'), {
      tenantId: 'tenant-1',
      packageId: 'package-1',
      packageType: 'SCORM_2004',
      originalFileName: 'notes.txt',
      mimeType: 'text/plain',
    })).rejects.toThrow(LearningContentStorageValidationError);
  });

  it('rejects reading a fileUrl from an unsupported storage scheme', async () => {
    await expect(service.read('s3://some-bucket/some-key')).rejects.toThrow(/Unsupported file reference/);
  });

  it('rejects a path-traversal attempt encoded in the file reference', async () => {
    await expect(service.read('local://learning-content/../../etc/passwd')).rejects.toThrow(LearningContentStorageValidationError);
  });

  it('rejects reading a reference that was never written', async () => {
    await expect(service.read('local://learning-content/tenant-1/package-1/does-not-exist.zip'))
      .rejects.toThrow(/was not found/);
  });

  it('sanitizes unsafe characters out of the original file name when storing', async () => {
    const saved = await service.save(Buffer.from('zip bytes'), {
      tenantId: 'tenant-1',
      packageId: 'package-1',
      packageType: 'XAPI',
      originalFileName: '../../evil name?.zip',
      mimeType: 'application/zip',
    });
    // The stored key must stay within the tenant/package directory — no traversal segments.
    expect(saved.fileUrl).not.toContain('..');
    const readBack = await service.read(saved.fileUrl);
    expect(readBack.toString()).toBe('zip bytes');
  });
});
