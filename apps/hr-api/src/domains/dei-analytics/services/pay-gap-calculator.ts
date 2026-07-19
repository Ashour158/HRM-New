import { mean, median, groupBy, roundTo } from './stats-utils.js';

/**
 * Standard full-time annual working-hours convention (52 weeks * 40 hours)
 * used to convert an annualized compensation amount into an hourly rate for
 * gap analysis. This mirrors the common exempt-salary-to-hourly conversion
 * used in gender/ethnicity pay-gap reporting methodologies (e.g. UK Gender
 * Pay Gap Reporting "ordinary hours" convention approximates to this).
 */
export const ANNUAL_WORKING_HOURS = 2080;

/** Maps a PayGapReport.reportType to the worker demographic field that genuinely exists on worker records. */
export const DIMENSION_FIELD_BY_PAY_GAP_REPORT_TYPE: Record<'GENDER_PAY_GAP' | 'ETHNICITY_PAY_GAP', string> = {
  GENDER_PAY_GAP: 'gender',
  ETHNICITY_PAY_GAP: 'ethnicity',
};

export const UNSPECIFIED_DIMENSION = 'UNSPECIFIED';

/** Converts an annualized compensation amount to an hourly rate. */
export function amountToHourlyRate(annualAmount: number): number {
  return annualAmount / ANNUAL_WORKING_HOURS;
}

export interface PayGapWorkerRecord {
  workerId: string;
  /** Value of the protected-class dimension being analyzed (e.g. gender), or UNSPECIFIED. */
  dimensionValue: string;
  /** Hourly pay rate derived from the worker's latest effective compensation change. */
  hourlyRate: number;
  departmentId?: string;
  role?: string;
}

export interface PayGapStatistics {
  meanHourlyGap: number;
  medianHourlyGap: number;
  quartileDistribution: Record<string, unknown>;
}

interface DimensionStat {
  dimension: string;
  meanHourly: number;
  medianHourly: number;
  count: number;
}

function summarizeByDimension(records: PayGapWorkerRecord[]): DimensionStat[] {
  const byDimension = groupBy(records, (r) => r.dimensionValue);
  return Object.entries(byDimension).map(([dimension, recs]) => ({
    dimension,
    meanHourly: mean(recs.map((r) => r.hourlyRate)),
    medianHourly: median(recs.map((r) => r.hourlyRate)),
    count: recs.length,
  }));
}

/**
 * Computes a gap ratio between a reference cohort (the highest-paid
 * dimension group — analogous to "male" in a binary UK-style gender pay gap
 * calculation, generalized to any set of dimension values) and everyone
 * else, following the standard methodology:
 *
 *   gap = (referenceAverage - comparisonAverage) / referenceAverage
 *
 * A positive gap means the reference cohort is paid more on average; 0 means
 * no measurable gap (including when there is only one dimension value
 * present in the data, e.g. no demographic data collected for this field).
 */
function computeGap(records: PayGapWorkerRecord[], dimensionStats: DimensionStat[], statKey: 'meanHourly' | 'medianHourly'): { gap: number; referenceDimension: string } {
  if (dimensionStats.length === 0) return { gap: 0, referenceDimension: UNSPECIFIED_DIMENSION };
  const reference = dimensionStats.reduce((a, b) => (b[statKey] > a[statKey] ? b : a));
  const comparisonRecords = records.filter((r) => r.dimensionValue !== reference.dimension);
  if (comparisonRecords.length === 0 || reference[statKey] === 0) {
    return { gap: 0, referenceDimension: reference.dimension };
  }
  const comparisonValue = statKey === 'meanHourly'
    ? mean(comparisonRecords.map((r) => r.hourlyRate))
    : median(comparisonRecords.map((r) => r.hourlyRate));
  return {
    gap: roundTo((reference[statKey] - comparisonValue) / reference[statKey]),
    referenceDimension: reference.dimension,
  };
}

function computeQuartileDistribution(records: PayGapWorkerRecord[]): Record<string, unknown> {
  if (records.length === 0) return { sampleSize: 0, quartiles: {} };
  const sorted = [...records].sort((a, b) => a.hourlyRate - b.hourlyRate);
  const n = sorted.length;
  const quartileSize = Math.ceil(n / 4);
  const labels = ['lowerQuartile', 'lowerMiddleQuartile', 'upperMiddleQuartile', 'upperQuartile'];
  const quartiles: Record<string, unknown> = {};

  for (let i = 0; i < 4; i++) {
    const slice = sorted.slice(i * quartileSize, Math.min((i + 1) * quartileSize, n));
    const byDimension: Record<string, { headcount: number; percentage: number }> = {};
    for (const rec of slice) {
      byDimension[rec.dimensionValue] ??= { headcount: 0, percentage: 0 };
      byDimension[rec.dimensionValue].headcount += 1;
    }
    for (const bucket of Object.values(byDimension)) {
      bucket.percentage = slice.length > 0 ? roundTo((bucket.headcount / slice.length) * 100, 1) : 0;
    }
    quartiles[labels[i]] = { headcount: slice.length, byDimension };
  }

  return { sampleSize: n, quartiles };
}

/**
 * Computes a mean-hourly-gap breakdown for each value of `keyFn` (e.g.
 * department id, job title/"role"), so the top-line gap can be explained by
 * role/department cohort as required by pay-equity reporting practice.
 * Every cell surfaces a `headcount` so downstream k-anonymity suppression
 * (applyKAnonymitySuppression) can redact small cohorts.
 */
function computeGroupBreakdown(records: PayGapWorkerRecord[], keyFn: (r: PayGapWorkerRecord) => string): Record<string, unknown> {
  const groups = groupBy(records, keyFn);
  const result: Record<string, unknown> = {};
  for (const [key, recs] of Object.entries(groups)) {
    const dimensionStats = summarizeByDimension(recs);
    if (dimensionStats.length < 2) {
      result[key] = { headcount: recs.length, meanHourlyGap: null, insufficientDimensions: true };
      continue;
    }
    const { gap, referenceDimension } = computeGap(recs, dimensionStats, 'meanHourly');
    result[key] = { headcount: recs.length, referenceDimension, meanHourlyGap: gap };
  }
  return result;
}

/**
 * Computes mean/median hourly pay-gap statistics plus a quartile
 * distribution (with department/role breakdowns) from real per-worker pay
 * and dimension data. Small-cell counts are left as plain `headcount`
 * numbers here — suppression is applied by the caller via the existing
 * `applyKAnonymitySuppression` (aggregate-level), not duplicated here.
 */
export function calculatePayGapStatistics(records: PayGapWorkerRecord[]): PayGapStatistics {
  if (records.length === 0) {
    return {
      meanHourlyGap: 0,
      medianHourlyGap: 0,
      quartileDistribution: { sampleSize: 0, quartiles: {}, byDepartment: {}, byRole: {} },
    };
  }

  const dimensionStats = summarizeByDimension(records);
  const meanResult = computeGap(records, dimensionStats, 'meanHourly');
  const medianResult = computeGap(records, dimensionStats, 'medianHourly');

  return {
    meanHourlyGap: meanResult.gap,
    medianHourlyGap: medianResult.gap,
    quartileDistribution: {
      ...computeQuartileDistribution(records),
      referenceDimension: meanResult.referenceDimension,
      byDepartment: computeGroupBreakdown(records, (r) => r.departmentId ?? 'UNASSIGNED'),
      byRole: computeGroupBreakdown(records, (r) => r.role ?? UNSPECIFIED_DIMENSION),
    },
  };
}
