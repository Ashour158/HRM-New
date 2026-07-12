import { describe, expect, it } from 'vitest';
import { parseNullableNumeric, parseNumeric } from './numeric.js';

describe('parseNumeric', () => {
  it('parses a valid numeric-column string', () => {
    expect(parseNumeric('123.45')).toBe(123.45);
  });

  it('parses a negative value', () => {
    expect(parseNumeric('-42')).toBe(-42);
  });

  it('rejects a non-numeric string', () => {
    expect(() => parseNumeric('not-a-number')).toThrow(/Expected a numeric column value/);
  });

  it('rejects a value that parses to Infinity', () => {
    expect(() => parseNumeric('1e+400')).toThrow(/Expected a numeric column value/);
  });

  it('rejects a value that parses to -Infinity', () => {
    expect(() => parseNumeric('-1e+400')).toThrow(/Expected a numeric column value/);
  });
});

describe('parseNullableNumeric', () => {
  it('returns undefined for null', () => {
    expect(parseNullableNumeric(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(parseNullableNumeric(undefined)).toBeUndefined();
  });

  it('parses a valid numeric-column string', () => {
    expect(parseNullableNumeric('7.5')).toBe(7.5);
  });
});
