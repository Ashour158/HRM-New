import { ValidationError } from '@hcm/shared-kernel';
import { groupBy, roundTo } from './stats-utils.js';

export const SUPPORTED_ATTRITION_SEGMENT_TYPES = ['DEPARTMENT', 'EMPLOYMENT_TYPE', 'JOB_TITLE', 'GENDER'] as const;
export type AttritionSegmentType = (typeof SUPPORTED_ATTRITION_SEGMENT_TYPES)[number];

export const UNASSIGNED_SEGMENT = 'UNASSIGNED';
export const UNSPECIFIED_SEGMENT = 'UNSPECIFIED';

export interface AttritionWindow {
  start: Date;
  end: Date;
}

/**
 * Parses an AttritionSegmentReport.reportPeriod string into a concrete
 * [start, end) date window used to compute a real, bounded termination-rate
 * calculation. Supports the report-period formats used elsewhere in this
 * domain: plain year ("2026"), quarter ("2026-Q2"), and month ("2026-06").
 */
export function parseReportPeriod(reportPeriod: string): AttritionWindow {
  const yearOnly = /^(\d{4})$/.exec(reportPeriod);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
  }

  const quarterMatch = /^(\d{4})-Q([1-4])$/i.exec(reportPeriod);
  if (quarterMatch) {
    const year = Number(quarterMatch[1]);
    const quarter = Number(quarterMatch[2]);
    const startMonth = (quarter - 1) * 3;
    return { start: new Date(Date.UTC(year, startMonth, 1)), end: new Date(Date.UTC(year, startMonth + 3, 1)) };
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(reportPeriod);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]) - 1;
    return { start: new Date(Date.UTC(year, month, 1)), end: new Date(Date.UTC(year, month + 1, 1)) };
  }

  throw new ValidationError(`Unsupported reportPeriod format: ${reportPeriod}. Expected "YYYY", "YYYY-QN", or "YYYY-MM".`);
}

export interface AttritionWorkerAttributes {
  departmentId?: string;
  employmentType?: string;
  jobTitle?: string;
  gender?: string;
}

/** Resolves the segment cohort a worker belongs to for a given segmentType. Throws for unsupported types rather than silently fabricating a cohort. */
export function resolveAttritionSegmentValue(segmentType: string, attrs: AttritionWorkerAttributes): string {
  const normalized = segmentType.toUpperCase();
  switch (normalized) {
    case 'DEPARTMENT':
      return attrs.departmentId ?? UNASSIGNED_SEGMENT;
    case 'EMPLOYMENT_TYPE':
      return attrs.employmentType ?? UNSPECIFIED_SEGMENT;
    case 'JOB_TITLE':
      return attrs.jobTitle ?? UNSPECIFIED_SEGMENT;
    case 'GENDER':
      return attrs.gender ?? UNSPECIFIED_SEGMENT;
    default:
      throw new ValidationError(
        `Unsupported attrition segmentType: ${segmentType}. Supported types: ${SUPPORTED_ATTRITION_SEGMENT_TYPES.join(', ')}.`,
      );
  }
}

export interface AttritionWorkerInput {
  workerId: string;
  hireDate: Date;
  terminationDate?: Date;
  segmentValue: string;
}

/**
 * Computes a real termination-rate-by-segment breakdown over a bounded time
 * window:
 *
 *   headcount     = workers in the segment who were already employed at the
 *                   start of the window and had not yet been terminated
 *   count         = workers in the segment terminated during [start, end)
 *   attritionRate = count / headcount (0 when there is no starting headcount)
 *
 * `headcount` and `count` use the exact key names the existing k-anonymity
 * suppression (applyKAnonymitySuppression) recognizes, so small cohorts are
 * redacted by the caller without any suppression logic duplicated here.
 */
export function calculateAttritionSegments(workers: AttritionWorkerInput[], window: AttritionWindow): Record<string, unknown> {
  const bySegment = groupBy(workers, (w) => w.segmentValue);
  const segments: Record<string, unknown> = {};

  for (const [segment, cohort] of Object.entries(bySegment)) {
    const headcount = cohort.filter(
      (w) => w.hireDate <= window.start && (!w.terminationDate || w.terminationDate >= window.start),
    ).length;
    const terminatedCount = cohort.filter(
      (w) => w.terminationDate && w.terminationDate >= window.start && w.terminationDate < window.end,
    ).length;

    segments[segment] = {
      headcount,
      count: terminatedCount,
      attritionRate: headcount > 0 ? roundTo(terminatedCount / headcount, 4) : 0,
    };
  }

  return {
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
    segments,
  };
}
