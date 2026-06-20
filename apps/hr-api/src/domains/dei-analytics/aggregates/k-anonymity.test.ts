import { describe, expect, it } from 'vitest';
import { applyKAnonymitySuppression, SUPPRESSED, DEFAULT_AGGREGATION_THRESHOLD } from './k-anonymity.js';

describe('applyKAnonymitySuppression', () => {
  it('suppresses count/headcount cells below the threshold', () => {
    const out = applyKAnonymitySuppression(
      { female: { count: 3 }, male: { count: 42 } },
      DEFAULT_AGGREGATION_THRESHOLD,
    ) as Record<string, { count: unknown }>;

    expect(out.female.count).toBe(SUPPRESSED);
    expect(out.male.count).toBe(42);
  });

  it('recurses through nested arrays and objects', () => {
    const out = applyKAnonymitySuppression(
      { segments: [{ region: 'AE', headcount: 2 }, { region: 'EG', headcount: 99 }] },
      5,
    ) as { segments: Array<{ headcount: unknown }> };

    expect(out.segments[0].headcount).toBe(SUPPRESSED);
    expect(out.segments[1].headcount).toBe(99);
  });

  it('leaves non-count numbers and other values untouched', () => {
    const out = applyKAnonymitySuppression({ meanGap: 1, label: 'x', count: 10 }, 5) as Record<string, unknown>;
    expect(out).toEqual({ meanGap: 1, label: 'x', count: 10 });
  });
});
