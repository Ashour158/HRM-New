import { describe, expect, it } from 'vitest';
import { computeWorkforceMetrics, type WorkforceSnapshotWorker } from './workforce-metrics-calculator.js';
import { applyKAnonymitySuppression, SUPPRESSED, DEFAULT_AGGREGATION_THRESHOLD } from '../aggregates/k-anonymity.js';

describe('computeWorkforceMetrics', () => {
  it('computes real headcount, gender, department, employment-type, and leadership breakdowns from a workforce snapshot', () => {
    const workers: WorkforceSnapshotWorker[] = [
      { workerId: 'w1', gender: 'FEMALE', departmentId: 'dept-a', employmentType: 'FULL_TIME', isManager: true },
      { workerId: 'w2', gender: 'MALE', departmentId: 'dept-a', employmentType: 'FULL_TIME', isManager: false },
      { workerId: 'w3', gender: 'FEMALE', departmentId: 'dept-b', employmentType: 'PART_TIME', isManager: false },
      { workerId: 'w4', gender: 'MALE', departmentId: 'dept-b', employmentType: 'FULL_TIME', isManager: true },
      { workerId: 'w5', gender: 'UNSPECIFIED', departmentId: undefined, employmentType: 'CONTRACTOR', isManager: false },
    ];

    const metrics = computeWorkforceMetrics(workers) as {
      totalHeadcount: number;
      genderDistribution: Record<string, { headcount: number }>;
      departmentDistribution: Record<string, { headcount: number }>;
      employmentTypeDistribution: Record<string, { headcount: number }>;
      leadershipRepresentation: Record<string, { headcount: number }>;
    };

    expect(metrics.totalHeadcount).toBe(5);
    expect(metrics.genderDistribution).toEqual({
      FEMALE: { headcount: 2 },
      MALE: { headcount: 2 },
      UNSPECIFIED: { headcount: 1 },
    });
    expect(metrics.departmentDistribution).toEqual({
      'dept-a': { headcount: 2 },
      'dept-b': { headcount: 2 },
      UNASSIGNED: { headcount: 1 },
    });
    expect(metrics.employmentTypeDistribution).toEqual({
      FULL_TIME: { headcount: 3 },
      PART_TIME: { headcount: 1 },
      CONTRACTOR: { headcount: 1 },
    });
    // Two managers: w1 (FEMALE) and w4 (MALE).
    expect(metrics.leadershipRepresentation).toEqual({
      FEMALE: { headcount: 1 },
      MALE: { headcount: 1 },
    });
  });

  it('handles an empty workforce snapshot without error', () => {
    const metrics = computeWorkforceMetrics([]) as { totalHeadcount: number };
    expect(metrics.totalHeadcount).toBe(0);
  });

  it('feeds correctly into the existing k-anonymity suppression: small gender cells get suppressed', () => {
    const workers: WorkforceSnapshotWorker[] = [
      ...Array.from({ length: 8 }, (_, i) => ({
        workerId: `m-${i}`,
        gender: 'MALE',
        departmentId: 'dept-a',
        employmentType: 'FULL_TIME',
        isManager: false,
      })),
      { workerId: 'f-1', gender: 'FEMALE', departmentId: 'dept-a', employmentType: 'FULL_TIME', isManager: false },
    ];

    const metrics = computeWorkforceMetrics(workers);
    const suppressed = applyKAnonymitySuppression(metrics, DEFAULT_AGGREGATION_THRESHOLD) as {
      genderDistribution: Record<string, { headcount: unknown }>;
    };

    expect(suppressed.genderDistribution.MALE.headcount).toBe(8);
    expect(suppressed.genderDistribution.FEMALE.headcount).toBe(SUPPRESSED);
  });
});
