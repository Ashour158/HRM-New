import { describe, expect, it } from 'vitest';
import { detectAttendancePayrollAnomaly, scoreAttritionRisk } from './index.js';

describe('hr-intelligence heuristic models', () => {
  it('scores attrition risk deterministically with explainable factors', () => {
    const result = scoreAttritionRisk({
      tenureMonths: 5,
      compPositionToBandMidpoint: 0.78,
      monthsSincePromotion: 48,
      engagementScoreTrend: -0.3,
      absenceDaysLast90: 9,
      managerChangesLast12Months: 2,
    });

    expect(result.modelKey).toBe('heuristic.attrition-risk');
    expect(result.modelVersion).toBe('2026.06.01');
    expect(result.score).toBe(0.685);
    expect(result.band).toBe('HIGH');
    expect(result.factors.map((entry) => entry.factor)).toContain('Engagement trend');
  });

  it('detects attendance/payroll anomalies with the same output contract', () => {
    const result = detectAttendancePayrollAnomaly({
      hoursWorked: 72,
      scheduledHours: 40,
      overtimeHours: 18,
      priorPeriodNetPay: 12000,
      currentNetPay: 9000,
      missingPunches: 2,
    });

    expect(result.modelKey).toBe('heuristic.attendance-payroll-anomaly');
    expect(result.score).toBe(0.867);
    expect(result.band).toBe('HIGH');
    expect(result.factors).toEqual(expect.arrayContaining([
      expect.objectContaining({ factor: 'Pay delta' }),
      expect.objectContaining({ factor: 'Missing punches' }),
    ]));
  });
});
