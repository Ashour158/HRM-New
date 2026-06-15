import { Uuid } from '@hcm/shared-kernel';

export type UuidInput = string | Uuid;

export function toUuid(value: UuidInput): Uuid {
  return value instanceof Uuid ? value : new Uuid(value);
}

export function toOptionalUuid(value?: UuidInput | null): Uuid | undefined {
  return value ? toUuid(value) : undefined;
}

export function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toOptionalDate(value?: Date | string | null): Date | undefined {
  return value ? toDate(value) : undefined;
}

export function toStringArray(value?: string[] | null): string[] | undefined {
  return Array.isArray(value) ? value.map(String) : undefined;
}
