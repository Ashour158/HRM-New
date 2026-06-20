import { describe, expect, it } from 'vitest';
import {
  parseLearningContentManifest,
  validateLearningContentPackage,
} from './learning-content-validation.js';

describe('parseLearningContentManifest', () => {
  it('extracts SCORM metadata from common manifest keys', () => {
    const parsed = parseLearningContentManifest('SCORM_2004', {
      identifier: 'COURSE-1',
      title: 'Safety',
      href: 'index.html',
      masteryScore: 80,
      scos: [{}, {}],
    });
    expect(parsed.identifier).toBe('COURSE-1');
    expect(parsed.launchUrl).toBe('index.html');
    expect(parsed.masteryScore).toBe(80);
    expect(parsed.scoCount).toBe(2);
  });

  it('extracts xAPI activity metadata', () => {
    const parsed = parseLearningContentManifest('XAPI', { activityId: 'http://x/act', endpoint: 'http://lrs' });
    expect(parsed.activityId).toBe('http://x/act');
    expect(parsed.endpoint).toBe('http://lrs');
  });
});

describe('validateLearningContentPackage', () => {
  it('is VALID for a complete SCORM package', () => {
    const r = validateLearningContentPackage({
      packageType: 'SCORM_1_2',
      fileUrl: 'https://cdn/p.zip',
      parsed: { identifier: 'C1', title: 'T', launchUrl: 'index.html' },
    });
    expect(r.valid).toBe(true);
    expect(r.decisionCode).toBe('VALID');
  });

  it('is INVALID when SCORM lacks a launch URL', () => {
    const r = validateLearningContentPackage({
      packageType: 'SCORM_2004',
      fileUrl: 'https://cdn/p.zip',
      parsed: { identifier: 'C1', title: 'T' },
    });
    expect(r.valid).toBe(false);
    expect(r.violations.map((v) => v.code)).toContain('SCORM_MISSING_LAUNCH_URL');
  });

  it('is INVALID when the file URL is missing', () => {
    const r = validateLearningContentPackage({
      packageType: 'SCORM_1_2',
      fileUrl: '',
      parsed: { identifier: 'C1', title: 'T', launchUrl: 'i.html' },
    });
    expect(r.violations.map((v) => v.code)).toContain('MISSING_FILE_URL');
  });

  it('is INVALID for xAPI without activity or endpoint', () => {
    const r = validateLearningContentPackage({ packageType: 'XAPI', fileUrl: 'u', parsed: { title: 'T' } });
    expect(r.violations.map((v) => v.code)).toContain('XAPI_MISSING_ACTIVITY');
  });

  it('rejects an out-of-range mastery score', () => {
    const r = validateLearningContentPackage({
      packageType: 'SCORM_1_2',
      fileUrl: 'u',
      parsed: { identifier: 'C1', launchUrl: 'i', title: 'T', masteryScore: 150 },
    });
    expect(r.violations.map((v) => v.code)).toContain('INVALID_MASTERY_SCORE');
  });

  it('REQUIRES_REVIEW when only a title is missing (warning)', () => {
    const r = validateLearningContentPackage({
      packageType: 'SCORM_1_2',
      fileUrl: 'u',
      parsed: { identifier: 'C1', launchUrl: 'i' },
    });
    expect(r.valid).toBe(true);
    expect(r.decisionCode).toBe('REQUIRES_REVIEW');
  });
});
