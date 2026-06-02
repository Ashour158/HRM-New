import { Uuid } from '@hcm/shared-kernel';

export type UuidInput = string | Uuid;

export function toUuid(value: UuidInput): Uuid {
  return value instanceof Uuid ? value : new Uuid(value);
}
