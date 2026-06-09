import { Injectable } from '@nestjs/common';
import type { AttendanceDailyLedger } from './attendance-ledger.service.js';

export interface AttendancePeriodReportDepartment {
  departmentName: string;
  employeeDays: number;
  present: number;
  absent: number;
  onLeave: number;
  exceptions: number;
  payableHours: number;
  deductionHours: number;
  overtimeHours: number;
}

export interface AttendancePeriodReport {
  periodStart: string;
  periodEnd: string;
  totals: Omit<AttendancePeriodReportDepartment, 'departmentName'>;
  departments: AttendancePeriodReportDepartment[];
}

export type AttendancePeriodViewRange = 'DAILY' | 'MONTHLY' | 'NINETY_DAYS' | 'WEEKLY';
export type AttendancePeriodViewScope = 'SELF' | 'TEAM' | 'TENANT';

export interface AttendancePeriodViewMetrics extends Omit<AttendancePeriodReportDepartment, 'departmentName'> {
  geofenceViolations: number;
  lateMinutes: number;
  missingCheckout: number;
  payrollReady: number;
  undertimeMinutes: number;
}

export interface AttendancePeriodViewDay extends AttendancePeriodViewMetrics {
  workDate: string;
}

export interface AttendancePeriodViewWorker extends AttendancePeriodViewMetrics {
  workerId: string;
  employeeId: string;
  name: string;
  departmentName?: string;
  managerId?: string;
}

export interface AttendancePeriodView {
  periodStart: string;
  periodEnd: string;
  range: AttendancePeriodViewRange;
  scope: AttendancePeriodViewScope;
  totals: AttendancePeriodViewMetrics;
  series: AttendancePeriodViewDay[];
  workers: AttendancePeriodViewWorker[];
  policyEvidence: {
    flexibleRuleCodes: string[];
    leavePolicyTypes: string[];
    scheduleSources: string[];
  };
}

function emptyDepartment(departmentName: string): AttendancePeriodReportDepartment {
  return {
    departmentName,
    employeeDays: 0,
    present: 0,
    absent: 0,
    onLeave: 0,
    exceptions: 0,
    payableHours: 0,
    deductionHours: 0,
    overtimeHours: 0,
  };
}

function emptyMetrics(): AttendancePeriodViewMetrics {
  return {
    employeeDays: 0,
    present: 0,
    absent: 0,
    onLeave: 0,
    exceptions: 0,
    payableHours: 0,
    deductionHours: 0,
    overtimeHours: 0,
    geofenceViolations: 0,
    lateMinutes: 0,
    missingCheckout: 0,
    payrollReady: 0,
    undertimeMinutes: 0,
  };
}

function addRow(target: AttendancePeriodReportDepartment, row: AttendanceDailyLedger['rows'][number]): void {
  target.employeeDays += 1;
  target.present += row.status === 'OUT' || row.status === 'PRESENT' || row.status === 'OVERTIME' ? 1 : 0;
  target.absent += row.status === 'ABSENT' ? 1 : 0;
  target.onLeave += row.status === 'ON_LEAVE' ? 1 : 0;
  target.exceptions += row.exceptions.length;
  target.payableHours += row.payrollInput.payableMinutes / 60;
  target.deductionHours += row.payrollInput.deductionMinutes / 60;
  target.overtimeHours += row.payrollInput.overtimeMinutes / 60;
}

function addViewRow(target: AttendancePeriodViewMetrics, row: AttendanceDailyLedger['rows'][number]): void {
  target.employeeDays += 1;
  target.present += row.status === 'OUT' || row.status === 'PRESENT' || row.status === 'OVERTIME' ? 1 : 0;
  target.absent += row.status === 'ABSENT' ? 1 : 0;
  target.onLeave += row.status === 'ON_LEAVE' ? 1 : 0;
  target.exceptions += row.exceptions.length;
  target.payableHours += row.payrollInput.payableMinutes / 60;
  target.deductionHours += row.payrollInput.deductionMinutes / 60;
  target.overtimeHours += row.payrollInput.overtimeMinutes / 60;
  target.geofenceViolations += row.status === 'GEOFENCE_VIOLATION' || row.calculation.geofenceViolation ? 1 : 0;
  target.lateMinutes += row.calculation.lateMinutes;
  target.missingCheckout += row.status === 'MISSING_CHECKOUT' ? 1 : 0;
  target.payrollReady += row.payrollInput.readyForPayroll ? 1 : 0;
  target.undertimeMinutes += row.calculation.undertimeMinutes;
}

function roundReportValues(target: AttendancePeriodReportDepartment): AttendancePeriodReportDepartment {
  return {
    ...target,
    payableHours: Math.round(target.payableHours * 100) / 100,
    deductionHours: Math.round(target.deductionHours * 100) / 100,
    overtimeHours: Math.round(target.overtimeHours * 100) / 100,
  };
}

function roundMetrics(target: AttendancePeriodViewMetrics): AttendancePeriodViewMetrics {
  return {
    ...target,
    payableHours: Math.round(target.payableHours * 100) / 100,
    deductionHours: Math.round(target.deductionHours * 100) / 100,
    overtimeHours: Math.round(target.overtimeHours * 100) / 100,
  };
}

function pushUnique(target: Set<string>, value?: string): void {
  if (value && value.trim().length > 0) target.add(value);
}

@Injectable()
export class AttendanceReportingService {
  buildPeriodSummary(input: {
    periodStart: string;
    periodEnd: string;
    ledgers: AttendanceDailyLedger[];
  }): AttendancePeriodReport {
    const byDepartment = new Map<string, AttendancePeriodReportDepartment>();
    const totals = emptyDepartment('__TOTAL__');

    for (const ledger of input.ledgers) {
      for (const row of ledger.rows) {
        const departmentName = row.worker.departmentName ?? 'Unassigned';
        const department = byDepartment.get(departmentName) ?? emptyDepartment(departmentName);
        addRow(department, row);
        addRow(totals, row);
        byDepartment.set(departmentName, department);
      }
    }

    return {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      totals: roundReportValues(totals),
      departments: [...byDepartment.values()]
        .map(roundReportValues)
        .sort((left, right) => left.departmentName.localeCompare(right.departmentName)),
    };
  }

  toCsv(report: AttendancePeriodReport): string {
    const headers = [
      'departmentName',
      'employeeDays',
      'present',
      'absent',
      'onLeave',
      'exceptions',
      'payableHours',
      'deductionHours',
      'overtimeHours',
    ];
    const rows = report.departments.map((department) => [
      department.departmentName,
      department.employeeDays,
      department.present,
      department.absent,
      department.onLeave,
      department.exceptions,
      department.payableHours,
      department.deductionHours,
      department.overtimeHours,
    ]);
    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  buildPeriodView(input: {
    periodStart: string;
    periodEnd: string;
    range: AttendancePeriodViewRange;
    scope: AttendancePeriodViewScope;
    ledgers: AttendanceDailyLedger[];
  }): AttendancePeriodView {
    const totals = emptyMetrics();
    const byDay = new Map<string, AttendancePeriodViewDay>();
    const byWorker = new Map<string, AttendancePeriodViewWorker>();
    const scheduleSources = new Set<string>();
    const flexibleRuleCodes = new Set<string>();
    const leavePolicyTypes = new Set<string>();

    for (const ledger of input.ledgers) {
      const day = byDay.get(ledger.workDate) ?? { workDate: ledger.workDate, ...emptyMetrics() };
      for (const row of ledger.rows) {
        addViewRow(totals, row);
        addViewRow(day, row);

        const worker = byWorker.get(row.worker.workerId) ?? {
          workerId: row.worker.workerId,
          employeeId: row.worker.employeeId,
          name: row.worker.name,
          departmentName: row.worker.departmentName,
          managerId: row.worker.managerId,
          ...emptyMetrics(),
        };
        addViewRow(worker, row);
        byWorker.set(row.worker.workerId, worker);

        pushUnique(scheduleSources, row.policyEvidence.schedule.source);
        pushUnique(flexibleRuleCodes, row.policyEvidence.flexibleRuleCode);
        pushUnique(leavePolicyTypes, row.policyEvidence.leave?.absenceType);
      }
      byDay.set(ledger.workDate, day);
    }

    return {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      range: input.range,
      scope: input.scope,
      totals: roundMetrics(totals),
      series: [...byDay.values()]
        .map((day) => ({ ...roundMetrics(day), workDate: day.workDate }))
        .sort((left, right) => left.workDate.localeCompare(right.workDate)),
      workers: [...byWorker.values()]
        .map((worker) => ({ ...roundMetrics(worker), workerId: worker.workerId, employeeId: worker.employeeId, name: worker.name, departmentName: worker.departmentName, managerId: worker.managerId }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      policyEvidence: {
        flexibleRuleCodes: [...flexibleRuleCodes].sort(),
        leavePolicyTypes: [...leavePolicyTypes].sort(),
        scheduleSources: [...scheduleSources].sort(),
      },
    };
  }
}
