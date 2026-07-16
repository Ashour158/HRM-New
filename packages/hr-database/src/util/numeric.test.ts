import { describe, expect, it } from 'vitest';
import { parseNumeric, parseNullableNumeric } from './numeric.js';

describe('parseNumeric', () => {
  it('parses a Postgres NUMERIC column value returned as a string', () => {
    // This is the exact bug: node-postgres returns NUMERIC columns as
    // strings. A raw `Number(value)` cast happens to work for well-formed
    // values, but nothing guarantees callers remember to convert at all --
    // parseNumeric makes that conversion the only way to get the value out.
    expect(parseNumeric('1234.50')).toBe(1234.5);
    expect(parseNumeric('0')).toBe(0);
    expect(parseNumeric('-42.75')).toBe(-42.75);
  });

  it('parses a valid numeric-column string', () => {
    expect(parseNumeric('123.45')).toBe(123.45);
  });

  it('parses a negative value', () => {
    expect(parseNumeric('-42')).toBe(-42);
  });

  it('passes through values that are already numbers', () => {
    expect(parseNumeric(10)).toBe(10);
    expect(parseNumeric(0)).toBe(0);
  });

  it('rejects a non-numeric string', () => {
    expect(() => parseNumeric('not-a-number')).toThrow(/Expected a numeric value/);
  });

  it('throws instead of silently producing NaN for a non-numeric string', () => {
    // Previously: Number('N/A') is NaN, which would silently poison any
    // downstream sum/total instead of failing loudly at the read boundary.
    expect(() => parseNumeric('N/A')).toThrow(/Expected a numeric value/);
  });

  it('rejects a value that parses to Infinity', () => {
    expect(() => parseNumeric('1e+400')).toThrow(/Expected a numeric value/);
  });

  it('rejects a value that parses to -Infinity', () => {
    expect(() => parseNumeric('-1e+400')).toThrow(/Expected a numeric value/);
  });

  it('throws instead of silently producing Infinity for an out-of-range string', () => {
    // Number.isNaN(Infinity) is false, so a NaN-only guard would let this
    // through. Number('1e+400') parses to Infinity.
    expect(() => parseNumeric('1e+400')).toThrow(/Expected a numeric value/);
    expect(() => parseNumeric('-1e+400')).toThrow(/Expected a numeric value/);
  });

  it('throws on an empty string rather than silently coercing to 0', () => {
    expect(() => parseNumeric('')).toThrow(/Expected a numeric value/);
  });
});

describe('parseNullableNumeric', () => {
  it('returns undefined for null', () => {
    expect(parseNullableNumeric(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(parseNullableNumeric(undefined)).toBeUndefined();
  });

  it('returns undefined for null and undefined without throwing', () => {
    expect(parseNullableNumeric(null)).toBeUndefined();
    expect(parseNullableNumeric(undefined)).toBeUndefined();
  });

  it('parses a valid numeric-column string', () => {
    expect(parseNullableNumeric('7.5')).toBe(7.5);
  });

  it('parses a present numeric-string value', () => {
    expect(parseNullableNumeric('99.99')).toBe(99.99);
  });

  it('passes through a present numeric value', () => {
    expect(parseNullableNumeric(5)).toBe(5);
  });

  it('still throws for a present but invalid value', () => {
    expect(() => parseNullableNumeric('garbage')).toThrow(/Expected a numeric value/);
  });
});
