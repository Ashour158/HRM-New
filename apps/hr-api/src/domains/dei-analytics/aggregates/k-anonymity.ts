/**
 * k-anonymity small-cell suppression for DEI / people-analytics data.
 *
 * Recursively walks a metrics/segments structure and replaces any `count` or
 * `headcount` value below the aggregation threshold with the sentinel
 * `'SUPPRESSED'`, so published reports cannot expose individuals through small
 * demographic cells. Shared by every DEI aggregate that stores demographic
 * breakdowns (DEI reports, pay-gap quartiles, pay-equity findings, attrition
 * segments) to guarantee consistent suppression across the domain.
 */
export const SUPPRESSED = 'SUPPRESSED';

/** Default minimum cell size below which counts are suppressed. */
export const DEFAULT_AGGREGATION_THRESHOLD = 5;

const SUPPRESSIBLE_COUNT_KEYS = new Set(['count', 'headcount']);

export function applyKAnonymitySuppression(data: unknown, threshold: number): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => applyKAnonymitySuppression(item, threshold));
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SUPPRESSIBLE_COUNT_KEYS.has(k) && typeof v === 'number' && v < threshold) {
        out[k] = SUPPRESSED;
      } else {
        out[k] = applyKAnonymitySuppression(v, threshold);
      }
    }
    return out;
  }
  return data;
}
