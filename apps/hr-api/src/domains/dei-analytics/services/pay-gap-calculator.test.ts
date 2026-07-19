import { describe, expect, it } from 'vitest';
import {
  amountToHourlyRate,
  calculatePayGapStatistics,
  ANNUAL_WORKING_HOURS,
  type PayGapWorkerRecord,
} from './pay-gap-calculator.js';
import { applyKAnonymitySuppression, SUPPRESSED, DEFAULT_AGGREGATION_THRESHOLD } from '../aggregates/k-anonymity.js';

describe('amountToHourlyRate', () => {
  it('converts an annual salary to an hourly rate using the standard 2080-hour work year', () => {
    expect(ANNUAL_WORKING_HOURS).toBe(2080);
    expect(amountToHourlyRate(104000)).toBe(50);
    expect(amountToHourlyRate(41600)).toBe(20);
  });
});

describe('calculatePayGapStatistics', () => {
  it('returns zeroed statistics for an empty dataset', () => {
    const result = calculatePayGapStatistics([]);
    expect(result.meanHourlyGap).toBe(0);
    expect(result.medianHourlyGap).toBe(0);
    expect(result.quartileDistribution).toMatchObject({ sampleSize: 0 });
  });

  it('computes real mean/median hourly gaps and department/role breakdowns from realistic sample worker+compensation data', () => {
    const records: PayGapWorkerRecord[] = [
      { workerId: 'w1', dimensionValue: 'MALE', hourlyRate: 50, departmentId: 'dept-a', role: 'Engineer' },
      { workerId: 'w2', dimensionValue: 'MALE', hourlyRate: 60, departmentId: 'dept-a', role: 'Engineer' },
      { workerId: 'w3', dimensionValue: 'FEMALE', hourlyRate: 40, departmentId: 'dept-a', role: 'Engineer' },
      { workerId: 'w4', dimensionValue: 'FEMALE', hourlyRate: 45, departmentId: 'dept-a', role: 'Engineer' },
      { workerId: 'w5', dimensionValue: 'MALE', hourlyRate: 80, departmentId: 'dept-b', role: 'Manager' },
      { workerId: 'w6', dimensionValue: 'FEMALE', hourlyRate: 70, departmentId: 'dept-b', role: 'Manager' },
    ];

    const result = calculatePayGapStatistics(records);

    // mean(MALE) = 190/3 = 63.3333, mean(FEMALE) = 155/3 = 51.6667
    // gap = (63.3333 - 51.6667) / 63.3333 = 0.1842
    expect(result.meanHourlyGap).toBeCloseTo(0.1842, 3);
    // median(MALE) = 60, median(FEMALE) = 45 -> gap = 15/60 = 0.25
    expect(result.medianHourlyGap).toBeCloseTo(0.25, 4);

    const qd = result.quartileDistribution as {
      referenceDimension: string;
      byDepartment: Record<string, { headcount: number; meanHourlyGap: number }>;
      byRole: Record<string, { headcount: number; meanHourlyGap: number }>;
    };
    expect(qd.referenceDimension).toBe('MALE');

    // dept-a: MALE mean=(50+60)/2=55, FEMALE mean=(40+45)/2=42.5 -> gap=(55-42.5)/55=0.2273
    expect(qd.byDepartment['dept-a'].headcount).toBe(4);
    expect(qd.byDepartment['dept-a'].meanHourlyGap).toBeCloseTo(0.2273, 3);
    // dept-b: MALE=80, FEMALE=70 -> gap=(80-70)/80=0.125
    expect(qd.byDepartment['dept-b'].headcount).toBe(2);
    expect(qd.byDepartment['dept-b'].meanHourlyGap).toBeCloseTo(0.125, 4);

    expect(qd.byRole['Engineer'].headcount).toBe(4);
    expect(qd.byRole['Manager'].headcount).toBe(2);
  });

  it('marks a department/role cohort with only one dimension value present as insufficientDimensions rather than fabricating a gap', () => {
    const records: PayGapWorkerRecord[] = [
      { workerId: 'w1', dimensionValue: 'MALE', hourlyRate: 50, departmentId: 'dept-a', role: 'Engineer' },
      { workerId: 'w2', dimensionValue: 'MALE', hourlyRate: 55, departmentId: 'dept-a', role: 'Engineer' },
    ];
    const result = calculatePayGapStatistics(records);
    expect(result.meanHourlyGap).toBe(0);
    expect(result.medianHourlyGap).toBe(0);
    const qd = result.quartileDistribution as { byDepartment: Record<string, { insufficientDimensions: boolean; meanHourlyGap: null }> };
    expect(qd.byDepartment['dept-a']).toEqual({ headcount: 2, meanHourlyGap: null, insufficientDimensions: true });
  });

  it('splits pay-sorted workers into four quartiles with per-dimension headcounts', () => {
    const records: PayGapWorkerRecord[] = [
      { workerId: 'w1', dimensionValue: 'FEMALE', hourlyRate: 30 },
      { workerId: 'w2', dimensionValue: 'FEMALE', hourlyRate: 35 },
      { workerId: 'w3', dimensionValue: 'MALE', hourlyRate: 40 },
      { workerId: 'w4', dimensionValue: 'FEMALE', hourlyRate: 45 },
      { workerId: 'w5', dimensionValue: 'MALE', hourlyRate: 50 },
      { workerId: 'w6', dimensionValue: 'MALE', hourlyRate: 55 },
      { workerId: 'w7', dimensionValue: 'FEMALE', hourlyRate: 60 },
      { workerId: 'w8', dimensionValue: 'MALE', hourlyRate: 65 },
    ];

    const result = calculatePayGapStatistics(records);
    const qd = result.quartileDistribution as {
      sampleSize: number;
      quartiles: Record<string, { headcount: number; byDimension: Record<string, { headcount: number; percentage: number }> }>;
    };

    expect(qd.sampleSize).toBe(8);
    expect(qd.quartiles.lowerQuartile).toEqual({ headcount: 2, byDimension: { FEMALE: { headcount: 2, percentage: 100 } } });
    expect(qd.quartiles.lowerMiddleQuartile.headcount).toBe(2);
    expect(qd.quartiles.lowerMiddleQuartile.byDimension.MALE.headcount).toBe(1);
    expect(qd.quartiles.lowerMiddleQuartile.byDimension.FEMALE.headcount).toBe(1);
    expect(qd.quartiles.upperMiddleQuartile).toEqual({ headcount: 2, byDimension: { MALE: { headcount: 2, percentage: 100 } } });
    expect(qd.quartiles.upperQuartile.headcount).toBe(2);
  });

  it('feeds correctly into the existing k-anonymity suppression: small department/quartile cells get suppressed, larger ones do not', () => {
    // dept-small has only 3 workers (< default threshold of 5) -> its headcount cell must be suppressed.
    // dept-large has 6 workers (>= threshold) -> its headcount cell must survive.
    const records: PayGapWorkerRecord[] = [
      { workerId: 'w1', dimensionValue: 'MALE', hourlyRate: 50, departmentId: 'dept-small', role: 'Engineer' },
      { workerId: 'w2', dimensionValue: 'FEMALE', hourlyRate: 45, departmentId: 'dept-small', role: 'Engineer' },
      { workerId: 'w3', dimensionValue: 'FEMALE', hourlyRate: 48, departmentId: 'dept-small', role: 'Engineer' },
      { workerId: 'w4', dimensionValue: 'MALE', hourlyRate: 60, departmentId: 'dept-large', role: 'Manager' },
      { workerId: 'w5', dimensionValue: 'MALE', hourlyRate: 62, departmentId: 'dept-large', role: 'Manager' },
      { workerId: 'w6', dimensionValue: 'MALE', hourlyRate: 61, departmentId: 'dept-large', role: 'Manager' },
      { workerId: 'w7', dimensionValue: 'FEMALE', hourlyRate: 55, departmentId: 'dept-large', role: 'Manager' },
      { workerId: 'w8', dimensionValue: 'FEMALE', hourlyRate: 56, departmentId: 'dept-large', role: 'Manager' },
      { workerId: 'w9', dimensionValue: 'FEMALE', hourlyRate: 57, departmentId: 'dept-large', role: 'Manager' },
    ];

    const { quartileDistribution } = calculatePayGapStatistics(records);
    const suppressed = applyKAnonymitySuppression(quartileDistribution, DEFAULT_AGGREGATION_THRESHOLD) as {
      byDepartment: Record<string, { headcount: unknown }>;
    };

    expect(suppressed.byDepartment['dept-small'].headcount).toBe(SUPPRESSED);
    expect(suppressed.byDepartment['dept-large'].headcount).toBe(6);
  });
});
