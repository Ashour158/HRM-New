import { describe, expect, it } from 'vitest';
import { PerformanceGoalPolicyService } from './performance-goal-policy.service.js';

describe('PerformanceGoalPolicyService', () => {
  const service = new PerformanceGoalPolicyService();

  it('accepts goals only when SMART fields are complete and time-bound', () => {
    const result = service.validateSmartGoal({
      title: 'Improve customer response quality',
      description: 'Raise QA score through weekly coaching and ticket review.',
      targetValue: 95,
      unit: '%',
      startDate: new Date('2026-06-01'),
      dueDate: new Date('2026-08-31'),
      smartCriteria: {
        specific: 'Improve customer response quality for tier 1 tickets.',
        measurable: 'Average QA score reaches 95%.',
        achievable: 'Weekly coaching and QA sampling are available.',
        relevant: 'Supports customer retention and service quality.',
        timeBound: 'Complete by 2026-08-31.',
      },
      metricName: 'QA score',
    });

    expect(result.valid).toBe(true);
    expect(result.score).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it('rejects vague goals that are not measurable or time-bound', () => {
    const result = service.validateSmartGoal({
      title: 'Do better',
      description: 'Improve work',
      startDate: new Date('2026-06-01'),
      smartCriteria: {
        specific: '',
        measurable: '',
        achievable: 'Try harder',
        relevant: '',
        timeBound: '',
      },
    });

    expect(result.valid).toBe(false);
    expect(result.score).toBeLessThan(70);
    expect(result.missing).toEqual(expect.arrayContaining(['specific', 'measurable', 'relevant', 'timeBound', 'targetValue', 'dueDate', 'metricName']));
  });
});
