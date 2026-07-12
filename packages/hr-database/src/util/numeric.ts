/**
 * node-postgres returns NUMERIC/DECIMAL columns as strings (see
 * connection/pool.ts) to avoid float precision loss on arbitrary-precision
 * decimal values. Repositories must convert deliberately at the read
 * boundary rather than let a numeric-column string flow into aggregate
 * arithmetic unconverted -- that produces string concatenation instead of
 * addition. Use these when mapping a Kysely row into an aggregate.
 */
export function parseNumeric(value: string): number {
  const parsed = Number(value);
  // Number.isFinite (not isNaN) so out-of-range values that parse to
  // Infinity/-Infinity (e.g. "1e+400") are rejected too, not just NaN.
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a numeric column value, got non-numeric string: ${JSON.stringify(value)}`);
  }
  return parsed;
}

export function parseNullableNumeric(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  return parseNumeric(value);
}
