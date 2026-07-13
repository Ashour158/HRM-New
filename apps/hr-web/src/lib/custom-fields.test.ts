import { describe, expect, it } from 'vitest';
import { hasCustomFieldValue, isCustomFieldRule, isCustomFieldRuleKey, KNOWN_FIELD_RULE_KEYS } from './custom-fields';

describe('custom-fields', () => {
  it('treats the fixed, built-in fields as known (not custom)', () => {
    for (const key of KNOWN_FIELD_RULE_KEYS) {
      expect(isCustomFieldRuleKey(key)).toBe(false);
    }
  });

  it('treats an admin-defined field key as custom', () => {
    expect(isCustomFieldRuleKey('badgeColor')).toBe(true);
    expect(isCustomFieldRuleKey('customField12345')).toBe(true);
    expect(isCustomFieldRule({ fieldKey: 'shiftCount' })).toBe(true);
  });

  it('reports whether a value counts as filled', () => {
    expect(hasCustomFieldValue(undefined)).toBe(false);
    expect(hasCustomFieldValue(null)).toBe(false);
    expect(hasCustomFieldValue('')).toBe(false);
    expect(hasCustomFieldValue([])).toBe(false);
    expect(hasCustomFieldValue({})).toBe(false);
    expect(hasCustomFieldValue(0)).toBe(true);
    expect(hasCustomFieldValue(false)).toBe(true);
    expect(hasCustomFieldValue('Blue')).toBe(true);
    expect(hasCustomFieldValue(['a'])).toBe(true);
  });
});
