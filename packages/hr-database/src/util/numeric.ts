/**
 * node-postgres returns NUMERIC/DECIMAL (and BIGINT) columns as strings by
 * default -- to avoid float precision loss on arbitrary-precision decimal
 * values -- but this package's generated row types are not (yet, everywhere)
 * flipped from `number` to `string` to reflect that at compile time. That
 * means a Kysely row's declared type can say `number` while the value that
 * actually comes back over the wire at runtime is a `string` (e.g.
 * `"1234.50"`). Passing that string straight into aggregate arithmetic
 * produces string concatenation instead of addition, and feeding a
 * concatenated string through a rounding helper produces NaN, not just a
 * wrong total.
 *
 * Repositories (and any other code mapping a raw DB/wire value into a typed
 * aggregate) must convert deliberately at the read boundary instead of
 * trusting the static type. These helpers accept both `string` and `number`
 * so they type-check against a column typed either way and are safe to call
 * unconditionally at every such boundary.
 */
export function parseNumeric(value: string | number): number {
  // Number('') and Number('   ') are 0, not NaN -- guard explicitly so a
  // missing/blank value can never silently masquerade as a real zero.
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(`Expected a numeric value, got: ${JSON.stringify(value)}`);
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  // Number.isFinite (not isNaN) so out-of-range values that parse to
  // Infinity/-Infinity (e.g. "1e+400") are rejected too, not just NaN.
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a numeric value, got: ${JSON.stringify(value)}`);
  }
  return parsed;
}

export function parseNullableNumeric(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  return parseNumeric(value);
}
