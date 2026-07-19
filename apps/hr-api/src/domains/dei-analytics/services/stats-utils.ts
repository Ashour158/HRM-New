/**
 * Small, dependency-free statistics helpers shared by the DEI analytics
 * computation services (pay-gap, workforce-metrics, attrition). Kept pure and
 * framework-free so they can be unit tested directly against realistic
 * sample data without spinning up NestJS or a database.
 */

/** Arithmetic mean. Returns 0 for an empty input (no divide-by-zero). */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Median (average of the two middle values for even-length arrays). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Groups items into buckets keyed by `keyFn(item)`. */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    (result[key] ??= []).push(item);
  }
  return result;
}

/** Counts items into `{ headcount }` buckets keyed by `keyFn(item)`. */
export function tallyBy<T>(items: T[], keyFn: (item: T) => string): Record<string, { headcount: number }> {
  const result: Record<string, { headcount: number }> = {};
  for (const item of items) {
    const key = keyFn(item);
    result[key] ??= { headcount: 0 };
    result[key].headcount += 1;
  }
  return result;
}

/** Rounds to a fixed number of decimal places (default 4) to avoid float noise in stored reports. */
export function roundTo(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
