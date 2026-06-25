/**
 * Bounds a client-supplied page size to a safe range.
 *
 * List endpoints accept `pageSize`/`limit` from the query string; without an
 * upper bound a caller can request millions of rows and exhaust memory / pin a
 * connection. `clampLimit` parses the raw value, falls back to `def` when it is
 * missing or non-numeric, and never exceeds `max`.
 */
export function clampLimit(
  raw: string | number | undefined,
  options: { def: number; max: number; min?: number },
): number {
  const min = options.min ?? 1;
  const parsed = typeof raw === 'number' ? raw : raw != null ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed)) return options.def;
  return Math.max(min, Math.min(Math.trunc(parsed), options.max));
}
