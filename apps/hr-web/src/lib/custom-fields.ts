import type { FieldRule } from '@/types';

/**
 * fieldKeys that already map to a real, dedicated input and payload property
 * on the employee create/profile forms. Any FieldRule whose fieldKey is NOT
 * in this set is a genuinely admin-defined custom field and must be rendered
 * with the dynamic field input and read/written through customFieldValues
 * instead of a fixed form property. Keep this in sync with
 * apps/hr-api/src/domains/hcm-setup/hcm-setup.types.ts KNOWN_FIELD_RULE_KEYS.
 */
export const KNOWN_FIELD_RULE_KEYS = new Set<string>([
  'firstName',
  'lastName',
  'personalEmail',
  'workEmail',
  'phoneNumber',
  'workPhoneNumber',
  'department',
  'jobTitle',
  'workAuthorization',
  'taxProfile',
  'bankAccount',
  'dependents',
  'beneficiaries',
  'assets',
  'skills',
  'consents',
  'employmentContract',
]);

export function isCustomFieldRuleKey(fieldKey: string): boolean {
  return !KNOWN_FIELD_RULE_KEYS.has(fieldKey);
}

export function isCustomFieldRule(rule: Pick<FieldRule, 'fieldKey'>): boolean {
  return isCustomFieldRuleKey(rule.fieldKey);
}

export function hasCustomFieldValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}
