import { z } from 'zod';

/**
 * Shared zod field builders for the react-hook-form + zodResolver form pattern.
 * See ./README.md for the full pattern write-up.
 *
 * These builders operate on the raw string values that HTML inputs produce
 * (react-hook-form keeps everything as `string` for text/number-ish inputs
 * unless you opt into `valueAsNumber`/`setValueAs`). That matches how this
 * codebase has always modeled form state (e.g. `minSalary: string` next to a
 * `numberValue()` conversion at submit time), so schemas built from these
 * helpers plug into existing payload-building code unchanged.
 */

/** A required, trimmed, non-empty string. */
export function requiredText(message: string) {
  return z.string().trim().min(1, message);
}

/**
 * A required string that must also parse as a finite number (still typed as
 * `string` — convert with `Number(value)` at submit time, same as before).
 */
export function requiredNumericText(requiredMessage: string, invalidMessage = 'Enter a valid number') {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .refine((value) => Number.isFinite(Number(value)), { message: invalidMessage });
}

/**
 * An optional string that, when non-blank, must parse as a finite number.
 * Blank stays valid so the field can be omitted from the submit payload.
 */
export function optionalNumericText(invalidMessage = 'Enter a valid number') {
  return z
    .string()
    .refine((value) => value.trim() === '' || Number.isFinite(Number(value)), { message: invalidMessage });
}

/**
 * A string that, when non-blank, must parse as a JSON object (not an array,
 * not a primitive). Blank is treated as valid (callers typically fall back
 * to `{}`). Use this instead of a bare `JSON.parse` in submit handlers —
 * unvalidated `JSON.parse` throws synchronously and can crash a mutation
 * instead of surfacing a field-level error.
 */
export function jsonObjectText(message: string) {
  return z.string().refine((value) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
    } catch {
      return false;
    }
  }, { message });
}
