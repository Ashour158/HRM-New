import { describe, expect, it } from 'vitest';
import { ValidationError } from '@hcm/shared-kernel';
import {
  calculateAttritionSegments,
  parseReportPeriod,
  resolveAttritionSegmentValue,
  type AttritionWorkerInput,
} from './attrition-calculator.js';
import { applyKAnonymitySuppression, SUPPRESSED, DEFAULT_AGGREGATION_THRESHOLD } from '../aggregates/k-anonymity.js';

describe('parseReportPeriod', () => {
  it('parses a plain year into a full calendar-year window', () => {
    const window = parseReportPeriod('2026');
    expect(window.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(window.end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('parses a quarter into a 3-month window', () => {
    const window = parseReportPeriod('2026-Q1');
    expect(window.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(window.end.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('parses a month into a 1-month window', () => {
    const window = parseReportPeriod('2026-06');
    expect(window.start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(window.end.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('rejects an unsupported reportPeriod format instead of guessing', () => {
    expect(() => parseReportPeriod('Q1-2026')).toThrow(ValidationError);
  });
});

describe('resolveAttritionSegmentValue', () => {
  it('resolves the cohort for each supported segment type, defaulting missing attributes', () => {
    expect(resolveAttritionSegmentValue('DEPARTMENT', { departmentId: 'dept-a' })).toBe('dept-a');
    expect(resolveAttritionSegmentValue('DEPARTMENT', {})).toBe('UNASSIGNED');
    expect(resolveAttritionSegmentValue('employment_type', { employmentType: 'CONTRACTOR' })).toBe('CONTRACTOR');
    expect(resolveAttritionSegmentValue('JOB_TITLE', { jobTitle: 'Engineer' })).toBe('Engineer');
    expect(resolveAttritionSegmentValue('GENDER', { gender: 'FEMALE' })).toBe('FEMALE');
    expect(resolveAttritionSegmentValue('GENDER', {})).toBe('UNSPECIFIED');
  });

  it('throws for an unsupported segment type instead of returning a fabricated cohort', () => {
    expect(() => resolveAttritionSegmentValue('TENURE_BAND', {})).toThrow(ValidationError);
  });
});

describe('calculateAttritionSegments', () => {
  it('computes real termination-rate-by-segment from realistic worker hire/termination data over a bounded window', () => {
    const window = parseReportPeriod('2026-Q1'); // 2026-01-01 .. 2026-04-01

    const workers: AttritionWorkerInput[] = [
      // dept-a: employed at window start, survives the window
      { workerId: 'w1', hireDate: new Date('2024-01-01'), segmentValue: 'dept-a' },
      // dept-a: employed at window start, terminated inside the window
      { workerId: 'w2', hireDate: new Date('2024-01-01'), terminationDate: new Date('2026-02-15'), segmentValue: 'dept-a' },
      // dept-a: already terminated before the window started -> not part of the starting headcount
      { workerId: 'w3', hireDate: new Date('2025-06-01'), terminationDate: new Date('2025-12-01'), segmentValue: 'dept-a' },
      // dept-b: employed at window start, survives
      { workerId: 'w4', hireDate: new Date('2023-01-01'), segmentValue: 'dept-b' },
      // dept-b: hired after the window started -> not part of the starting headcount
      { workerId: 'w5', hireDate: new Date('2026-02-01'), segmentValue: 'dept-b' },
      // dept-b: employed at window start, terminated after the window ended
      { workerId: 'w6', hireDate: new Date('2020-01-01'), terminationDate: new Date('2026-05-01'), segmentValue: 'dept-b' },
    ];

    const result = calculateAttritionSegments(workers, window) as {
      windowStart: string;
      windowEnd: string;
      segments: Record<string, { headcount: number; count: number; attritionRate: number }>;
    };

    expect(result.windowStart).toBe('2026-01-01T00:00:00.000Z');
    expect(result.windowEnd).toBe('2026-04-01T00:00:00.000Z');

    expect(result.segments['dept-a']).toEqual({ headcount: 2, count: 1, attritionRate: 0.5 });
    expect(result.segments['dept-b']).toEqual({ headcount: 2, count: 0, attritionRate: 0 });
  });

  it('reports zero attrition rate for a segment with no starting headcount rather than dividing by zero', () => {
    const window = parseReportPeriod('2026-Q1');
    const workers: AttritionWorkerInput[] = [
      { workerId: 'w1', hireDate: new Date('2026-02-01'), segmentValue: 'dept-new' },
    ];
    const result = calculateAttritionSegments(workers, window) as { segments: Record<string, { headcount: number; count: number; attritionRate: number }> };
    expect(result.segments['dept-new']).toEqual({ headcount: 0, count: 0, attritionRate: 0 });
  });

  it('feeds correctly into the existing k-anonymity suppression: small segment cells get suppressed, larger ones do not', () => {
    const window = parseReportPeriod('2026');
    const smallSegment: AttritionWorkerInput[] = Array.from({ length: 3 }, (_, i) => ({
      workerId: `small-${i}`,
      hireDate: new Date('2020-01-01'),
      segmentValue: 'tiny-dept',
    }));
    const largeSegment: AttritionWorkerInput[] = Array.from({ length: 6 }, (_, i) => ({
      workerId: `large-${i}`,
      hireDate: new Date('2020-01-01'),
      terminationDate: i < 5 ? new Date('2026-03-01') : undefined,
      segmentValue: 'big-dept',
    }));

    const result = calculateAttritionSegments([...smallSegment, ...largeSegment], window);
    const suppressed = applyKAnonymitySuppression(result, DEFAULT_AGGREGATION_THRESHOLD) as {
      segments: Record<string, { headcount: unknown; count: unknown }>;
    };

    expect(suppressed.segments['tiny-dept'].headcount).toBe(SUPPRESSED);
    expect(suppressed.segments['big-dept'].headcount).toBe(6);
    expect(suppressed.segments['big-dept'].count).toBe(5);
  });
});
