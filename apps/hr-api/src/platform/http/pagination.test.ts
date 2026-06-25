import { describe, expect, it } from 'vitest';
import { clampLimit } from './pagination.js';

describe('clampLimit', () => {
  const opts = { def: 50, max: 200 };

  it('returns the default when the value is missing or non-numeric', () => {
    expect(clampLimit(undefined, opts)).toBe(50);
    expect(clampLimit('abc', opts)).toBe(50);
  });

  it('caps an over-large value at max', () => {
    expect(clampLimit('10000000', opts)).toBe(200);
    expect(clampLimit(999999, opts)).toBe(200);
  });

  it('passes through an in-range value', () => {
    expect(clampLimit('75', opts)).toBe(75);
  });

  it('enforces a floor of min (default 1)', () => {
    expect(clampLimit('0', opts)).toBe(1);
    expect(clampLimit('-5', opts)).toBe(1);
  });
});
