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

function roundReportValues(target: AttendancePeriodReportDepartment): AttendancePeriodReportDepartment {
  return {
    ...target,
    payableHours: Math.round(target.payableHours * 100) / 100,
    deductionHours: Math.round(target.deductionHours * 100) / 100,
    overtimeHours: Math.round(target.overtimeHours * 100) / 100,
  };
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
}
