import { Uuid } from '@hcm/shared-kernel';

/**
 * Accepts either a raw UUID string (JSON command payload from an API layer) or
 * an already-constructed {@link Uuid} (in-process dispatch, e.g. from
 * `OfferToHireSaga`, which passes live `Uuid` instances rather than serialized
 * strings) and normalizes to a `Uuid` instance.
 */
export function coerceUuid(value: string | Uuid): Uuid {
  return value instanceof Uuid ? value : new Uuid(value);
}
