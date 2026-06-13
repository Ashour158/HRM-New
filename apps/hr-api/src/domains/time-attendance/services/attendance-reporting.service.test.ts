import { describe, expect, it } from 'vitest';
import { AttendanceReportingService } from './attendance-reporting.service.js';
import type { AttendanceDailyLedger } from './attendance-ledger.service.js';

function ledger(workDate: string, rows: AttendanceDailyLedger['rows']): AttendanceDailyLedger {
  return {
    workDate,
    rows,
    summary: {
      absent: rows.filter((row) => row.status === 'ABSENT').length,
      exceptions: rows.reduce((total, row) => total + row.exceptions.length, 0),
      geofenceViolations: rows.filter((row) => row.status === 'GEOFENCE_VIOLATION').length,
      inProgress: 0,
      late: 0,
      missingCheckout: 0,
      onLeave: rows.filter((row) => row.status === 'ON_LEAVE').length,
      payrollReady: rows.filter((row) => row.payrollInput.readyForPayroll).length,
      present: rows.filter((row) => row.status === 'OUT').length,
      totalEmployees: rows.length,
      undertime: 0,
    },
    exceptionQueue: [],
  };
}

function row(workerId: string, status: AttendanceDailyLedger['rows'][number]['status'], departmentName: string): AttendanceDailyLedger['rows'][number] {
  return {
    worker: {
      workerId,
      employeeId: workerId,
      name: `Employee ${workerId}`,
      email: `${workerId}@example.com`,
      departmentName,
      status: 'ACTIVE',
    },
    workDate: '2026-05-25',
    status,
    scheduled: true,
    locationStatus: 'WITHIN_GEOFENCE',
    calculation: {
      workDate: '2026-05-25',
      workedMinutes: status === 'OUT' ? 480 : 0,
      payableMinutes: status === 'ON_LEAVE' || status === 'OUT' ? 480 : 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      onDutyMinutes: 0,
      absent: status === 'ABSENT',
      geofenceViolation: false,
      lowTrustPunch: false,
      events: status === 'ABSENT' ? ['ABSENCE'] : [],
    },
    exceptions: [],
    payrollInput: {
      workDate: '2026-05-25',
      workedMinutes: status === 'OUT' ? 480 : 0,
      payableMinutes: status === 'ON_LEAVE' || status === 'OUT' ? 480 : 0,
      deductionMinutes: status === 'ABSENT' ? 480 : 0,
      overtimeMinutes: 0,
      readyForPayroll: status !== 'ABSENT',
      locked: false,
      source: 'ATTENDANCE_DAILY_LEDGER',
    },
    policyEvidence: {
      schedule: { source: 'TENANT_DEFAULT' },
      trust: { minClockTrustScore: 60, lowTrustBlocksPayroll: true },
    },
    governance: {
      visibilityScope: 'HR_ADMIN',
      locationDataClassification: 'CONFIDENTIAL',
      payrollDataClassification: 'CONFIDENTIAL',
    },
  };
}

describe('AttendanceReportingService', () => {
  const service = new AttendanceReportingService();

  it('summarizes period attendance by status and department', () => {
    const report = service.buildPeriodSummary({
      periodStart: '2026-05-25',
      periodEnd: '2026-05-26',
      ledgers: [
        ledger('2026-05-25', [row('EMP-001', 'OUT', 'Finance'), row('EMP-002', 'ON_LEAVE', 'Finance')]),
        ledger('2026-05-26', [row('EMP-001', 'ABSENT', 'Finance'), row('EMP-002', 'OUT', 'Finance')]),
      ],
    });

    expect(report.totals.employeeDays).toBe(4);
    expect(report.totals.present).toBe(2);
    expect(report.totals.onLeave).toBe(1);
    expect(report.totals.absent).toBe(1);
    expect(report.departments[0]?.payableHours).toBe(24);
  });

  it('builds a policy-aware attendance period view with series and worker rollups', () => {
    const firstDay = row('EMP-001', 'OUT', 'Finance');
    firstDay.calculation.lateMinutes = 12;
    firstDay.calculation.events = ['LATE'];
    firstDay.exceptions.push({
      code: 'LATE',
      description: 'Late arrival after grace period',
      severity: 'MEDIUM',
      requiresApproval: true,
      source: 'CALCULATED',
      status: 'OPEN',
      payrollImpactMinutes: 12,
    });
    firstDay.payrollInput.readyForPayroll = false;
    firstDay.policyEvidence.flexibleRuleCode = 'FLEX_CORE_CAIRO';
    firstDay.policyEvidence.schedule.source = 'WORKER_SCHEDULE';

    const secondDay = row('EMP-001', 'ON_LEAVE', 'Finance');
    secondDay.policyEvidence.leave = {
      absenceRequestId: 'leave-1',
      absenceType: 'ANNUAL',
      paid: true,
      startDate: '2026-05-26',
      endDate: '2026-05-26',
    };

    const view = service.buildPeriodView({
      periodStart: '2026-05-25',
      periodEnd: '2026-05-26',
      range: 'WEEKLY',
      scope: 'SELF',
      ledgers: [
        ledger('2026-05-25', [firstDay]),
        ledger('2026-05-26', [secondDay]),
      ],
    });

    expect(view.range).toBe('WEEKLY');
    expect(view.totals.employeeDays).toBe(2);
    expect(view.totals.present).toBe(1);
    expect(view.totals.onLeave).toBe(1);
    expect(view.totals.lateMinutes).toBe(12);
    expect(view.series).toEqual([
      expect.objectContaining({ workDate: '2026-05-25', present: 1, lateMinutes: 12 }),
      expect.objectContaining({ workDate: '2026-05-26', onLeave: 1 }),
    ]);
    expect(view.workers).toEqual([
      expect.objectContaining({
        workerId: 'EMP-001',
        employeeId: 'EMP-001',
        name: 'Employee EMP-001',
        present: 1,
        onLeave: 1,
        payableHours: 16,
      }),
    ]);
    expect(view.policyEvidence.scheduleSources).toEqual(['TENANT_DEFAULT', 'WORKER_SCHEDULE']);
    expect(view.policyEvidence.flexibleRuleCodes).toEqual(['FLEX_CORE_CAIRO']);
    expect(view.policyEvidence.leavePolicyTypes).toEqual(['ANNUAL']);
    expect(view.policyEvidence.eventCodes).toEqual(['LATE']);
    expect(view.policyEvidence.payrollBlockRules).toEqual(['LATE']);
    expect(view.policyEvidence.trustMinimums).toEqual([60]);
    expect(view.insights).toMatchObject({
      coverageRisk: 'MEDIUM',
      payrollBlockers: 1,
      policyViolations: 2,
      trend: 'IMPROVING',
    });
    expect(view.insights.attendanceScore).toBeLessThan(100);
    expect(view.workers[0]).toMatchObject({
      attendanceScore: expect.any(Number),
      payrollBlockers: 1,
      policyViolations: 2,
      riskLevel: 'MEDIUM',
    });
  });
});
