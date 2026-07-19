import { describe, expect, it } from 'vitest';
import { SelfServiceValidator } from './allowlists.js';

describe('SelfServiceValidator', () => {
  const validator = new SelfServiceValidator();

  it('allows managers to review, resolve, and escalate attendance exceptions (HCM-P0-9)', () => {
    expect(validator.isManagerAllowed('ReviewAttendanceException')).toBe(true);
    expect(validator.isManagerAllowed('ResolveAttendanceException')).toBe(true);
    expect(validator.isManagerAllowed('EscalateAttendanceException')).toBe(true);
  });
});
