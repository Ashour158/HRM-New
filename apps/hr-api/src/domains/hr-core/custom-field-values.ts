import { ValidationError } from '@hcm/shared-kernel';
import { isCustomFieldRuleKey, type FieldRule, type HcmSetupConfig } from '../hcm-setup/hcm-setup.types.js';

/**
 * Shared support for the genuinely dynamic custom-field-value store: any
 * FieldRule defined in Admin Settings whose fieldKey is not one of the fixed,
 * built-in worker fields (see KNOWN_FIELD_RULE_KEYS). Values for those fields
 * are persisted as a PersonalDataRecord with dataCategory 'CUSTOM', keyed by
 * fieldKey inside its JSON payload, and are used identically by worker
 * creation (create-worker.handler.ts) and profile section edits
 * (upsert-worker-profile-section.handler.ts).
 */

export function hasCustomFieldValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

/** Active FieldRules from Admin Settings that describe a genuinely custom field. */
export function activeCustomFieldRules(setup: HcmSetupConfig): FieldRule[] {
  return setup.fieldRules.filter((rule) => rule.active && isCustomFieldRuleKey(rule.fieldKey));
}

/**
 * Filters an incoming customFieldValues/fields map down to keys that
 * correspond to an active, admin-defined custom FieldRule. Any key that
 * doesn't match a configured rule is dropped rather than persisted, so a
 * client cannot smuggle arbitrary keys into the custom-field store.
 */
export function filterAllowedCustomFieldValues(
  values: Record<string, unknown> | undefined,
  setup: HcmSetupConfig,
): Record<string, unknown> {
  if (!values) return {};
  const allowedKeys = new Set(activeCustomFieldRules(setup).map((rule) => rule.fieldKey));
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => allowedKeys.has(key) && hasCustomFieldValue(value)));
}

/**
 * Validates a single custom field value against its FieldRule's configured
 * fieldType. Throws ValidationError with a human-readable message on
 * mismatch, matching how the other setup-governed validations in this domain
 * surface errors to the caller.
 */
export function validateCustomFieldValue(rule: FieldRule, value: unknown): void {
  const type = rule.fieldType ?? 'TEXT';
  switch (type) {
    case 'NUMBER':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ValidationError(`${rule.label || rule.fieldKey} must be a number`);
      }
      return;
    case 'BOOLEAN':
      if (typeof value !== 'boolean') {
        throw new ValidationError(`${rule.label || rule.fieldKey} must be true or false`);
      }
      return;
    case 'DATE': {
      const isValidDate = typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
      if (!isValidDate) {
        throw new ValidationError(`${rule.label || rule.fieldKey} must be a valid date`);
      }
      return;
    }
    case 'SELECT': {
      const options = rule.options ?? [];
      if (typeof value !== 'string' || (options.length > 0 && !options.includes(value))) {
        throw new ValidationError(`${rule.label || rule.fieldKey} must be one of the configured options`);
      }
      return;
    }
    case 'TEXT':
    default:
      if (typeof value !== 'string') {
        throw new ValidationError(`${rule.label || rule.fieldKey} must be text`);
      }
      return;
  }
}

/**
 * Validates required-ness and type for every active custom FieldRule against
 * a fully-merged view of a worker's custom field values (i.e. previously
 * stored values merged with the values being applied in this request).
 * `changedKeys` limits type validation to the fields actually supplied in
 * this request, so untouched previously-stored values are not re-validated
 * against a rule that may have since changed shape.
 */
export function validateCustomFieldSection(
  setup: HcmSetupConfig,
  mergedValues: Record<string, unknown>,
  changedKeys: ReadonlySet<string>,
): void {
  for (const rule of activeCustomFieldRules(setup)) {
    const value = mergedValues[rule.fieldKey];
    if (rule.required && !hasCustomFieldValue(value)) {
      throw new ValidationError(`${rule.label || rule.fieldKey} is required by Admin Settings`);
    }
    if (changedKeys.has(rule.fieldKey) && hasCustomFieldValue(value)) {
      validateCustomFieldValue(rule, value);
    }
  }
}
