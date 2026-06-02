import { Injectable } from '@nestjs/common';
import type { HcmSetupConfig } from '../../hcm-setup/hcm-setup.types.js';
import type { CoverageGap } from '../../workforce-management/aggregates/coverage-gap.aggregate.js';
import type { OpenShift } from '../../workforce-management/aggregates/open-shift.aggregate.js';
import type { ShiftSchedule } from '../../workforce-management/aggregates/shift-schedule.aggregate.js';
import type { WfmOvertimeApproval } from '../../workforce-management/aggregates/overtime-approval.aggregate.js';
import type { AttendanceDailyLedger, AttendanceLedgerRow } from './attendance-ledger.service.js';

export type SchedulingCommandCenterStatus = 'AT_RISK' | 'BLOCKED' | 'OK' | 'WARNING';

export interface AttendanceCaptureChannelReadiness {
  method: 'API_IMPORT' | 'BIOMETRIC_DEVICE' | 'FACIAL_RECOGNITION' | 'MANUAL_CORRECTION' | 'MOBILE_GEOFENCE' | 'QR_CODE' | 'RFID_CARD' | 'WEB_KIOSK';
  label: string;
  status: 'ACTIVE' | 'NEEDS_CONFIGURATION' | 'NOT_CONFIGURED';
  evidenceFields: string[];
  policyDriven: boolean;
  message: string;
}

export interface AttendanceCoverageSignal {
  department: string;
  scheduled: number;
  present: number;
  absent: number;
  onLeave: number;
  exceptionCount: number;
  overtimeMinutes: number;
  minimumStaffingTarget: number;
  gap: number;
  status: 'COVERED' | 'GAP' | 'WATCH';
}

export interface AttendanceFatigueRisk {
  workerId: string;
  employeeId: string;
  workerName: string;
  department?: string;
  riskCode: 'EXCESSIVE_DAILY_HOURS' | 'MISSING_REST_EVIDENCE' | 'OVERTIME_SPIKE' | 'UNSAFE_OPEN_SHIFT';
  severity: 'HIGH' | 'MEDIUM';
  message: string;
}

export interface AttendanceOptimizationSuggestion {
  code: string;
  priority: 'HIGH' | 'LOW' | 'MEDIUM';
  recommendation: string;
  reason: string;
  action: string;
}

export interface AttendanceSchedulingCommandCenter {
  workDate: string;
  workplaceCode?: string;
  status: SchedulingCommandCenterStatus;
  summary: {
    scheduledEmployees: number;
    presentEmployees: number;
    openShiftCount: number;
    activeCoverageGaps: number;
    overtimeMinutes: number;
    fatigueRiskCount: number;
    optimizationSuggestionCount: number;
  };
  captureChannels: AttendanceCaptureChannelReadiness[];
  schedulePatterns: Array<{
    code: string;
    label: string;
    type: 'FLEXIBLE_HOURS' | 'INDIVIDUAL_SCHEDULE' | 'SHIFT_ROTATION' | 'TENANT_DEFAULT';
    active: boolean;
    details: string;
  }>;
  coverage: AttendanceCoverageSignal[];
  roster: {
    assignedShifts: Array<{ id: string; workerId: string; shiftDate: string; startTime: string; endTime: string; status: string; departmentId: string; workplaceCode?: string }>;
    openShifts: Array<{ id: string; departmentId: string; shiftDate: string; startTime: string; endTime: string; requiredSkills: string[]; status: string; workplaceCode?: string }>;
    coverageGaps: Array<{ id: string; departmentId: string; shiftDate: string; startTime: string; endTime: string; requiredSkills: string[]; status: string; workplaceCode?: string }>;
  };
  overtime: {
    policyThresholdMinutes: number;
    pendingApprovals: number;
    dailyDetectedMinutes: number;
    controls: string[];
  };
  lateEarly: {
    lateEmployees: number;
    earlyDepartureProxyEmployees: number;
    graceMinutes: number;
    deductionPolicies: string[];
  };
  fatigueRisks: AttendanceFatigueRisk[];
  optimizationSuggestions: AttendanceOptimizationSuggestion[];
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function timeText(value: Date): string {
  return value.toISOString();
}

function hasActiveDeviceRule(setup: HcmSetupConfig, patterns: string[]): boolean {
  const normalized = patterns.map((pattern) => pattern.toLowerCase());
  return (setup.attendancePolicy.deviceTrustRules ?? []).some((rule) => {
    if (!rule.active) return false;
    const text = `${rule.code} ${rule.label} ${rule.deviceIdPattern}`.toLowerCase();
    return normalized.some((pattern) => text.includes(pattern));
  });
}

function statusPresent(row: AttendanceLedgerRow): boolean {
  return ['IN_PROGRESS', 'OUT', 'OVERTIME', 'PRESENT'].includes(row.status);
}

function isActiveGap(status: string): boolean {
  return status === 'DETECTED' || status === 'NOTIFIED';
}

function activeOpenShift(status: string): boolean {
  return status === 'OPEN' || status === 'BID_PENDING';
}

function isInWorkplaceScope(
  item: { departmentId: { value: string }; workplaceCode?: string },
  workplaceCode: string | undefined,
): boolean {
  if (!workplaceCode) return true;
  return item.workplaceCode === workplaceCode;
}

@Injectable()
export class AttendanceSchedulingCommandCenterService {
  build(input: {
    setup: HcmSetupConfig;
    ledger: AttendanceDailyLedger;
    shiftSchedules?: ShiftSchedule[];
    openShifts?: OpenShift[];
    coverageGaps?: CoverageGap[];
    overtimeApprovals?: WfmOvertimeApproval[];
    workplaceCode?: string;
  }): AttendanceSchedulingCommandCenter {
    const rows = input.ledger.rows;
    const workDate = input.ledger.workDate;
    const shiftSchedules = (input.shiftSchedules ?? []).filter((item) => dateKey(item.shiftDate) === workDate && isInWorkplaceScope(item, input.workplaceCode));
    const openShifts = (input.openShifts ?? []).filter((item) => dateKey(item.shiftDate) === workDate && activeOpenShift(item.status) && isInWorkplaceScope(item, input.workplaceCode));
    const coverageGaps = (input.coverageGaps ?? []).filter((item) => dateKey(item.shiftDate) === workDate && isActiveGap(item.status) && isInWorkplaceScope(item, input.workplaceCode));
    const scopedWorkerIds = new Set(rows.map((row) => row.worker.workerId));
    const overtimeApprovals = (input.overtimeApprovals ?? []).filter((item) => !input.workplaceCode || scopedWorkerIds.has(item.workerId.value));
    const coverage = this.buildCoverage(rows);
    const fatigueRisks = this.buildFatigueRisks(rows, openShifts);
    const captureChannels = this.buildCaptureChannels(input.setup);
    const optimizationSuggestions = this.buildOptimizationSuggestions({
      rows,
      captureChannels,
      coverage,
      openShifts,
      coverageGaps,
      fatigueRisks,
    });
    const overtimeMinutes = rows.reduce((total, row) => total + row.payrollInput.overtimeMinutes, 0);
    const presentEmployees = rows.filter(statusPresent).length;
    const activeCoverageGaps = coverageGaps.length + coverage.filter((item) => item.status === 'GAP').length;
    const status: SchedulingCommandCenterStatus = activeCoverageGaps > 0 || fatigueRisks.some((risk) => risk.severity === 'HIGH')
      ? 'AT_RISK'
      : input.ledger.exceptionQueue.some((item) => item.severity === 'HIGH')
        ? 'WARNING'
        : 'OK';

    return {
      workDate,
      workplaceCode: input.workplaceCode,
      status,
      summary: {
        scheduledEmployees: rows.filter((row) => row.scheduled).length,
        presentEmployees,
        openShiftCount: openShifts.length,
        activeCoverageGaps,
        overtimeMinutes,
        fatigueRiskCount: fatigueRisks.length,
        optimizationSuggestionCount: optimizationSuggestions.length,
      },
      captureChannels,
      schedulePatterns: this.buildSchedulePatterns(input.setup, rows),
      coverage,
      roster: {
        assignedShifts: shiftSchedules.map((item) => ({
          id: item.id.value,
          workerId: item.workerId.value,
          shiftDate: dateKey(item.shiftDate),
          startTime: timeText(item.startTime),
          endTime: timeText(item.endTime),
          status: item.status,
          departmentId: item.departmentId.value,
          workplaceCode: item.workplaceCode,
        })),
        openShifts: openShifts.map((item) => ({
          id: item.id.value,
          departmentId: item.departmentId.value,
          shiftDate: dateKey(item.shiftDate),
          startTime: timeText(item.startTime),
          endTime: timeText(item.endTime),
          requiredSkills: item.requiredSkills ?? [],
          status: item.status,
          workplaceCode: item.workplaceCode,
        })),
        coverageGaps: coverageGaps.map((item) => ({
          id: item.id.value,
          departmentId: item.departmentId.value,
          shiftDate: dateKey(item.shiftDate),
          startTime: timeText(item.startTime),
          endTime: timeText(item.endTime),
          requiredSkills: item.requiredSkills ?? [],
          status: item.status,
          workplaceCode: item.workplaceCode,
        })),
      },
      overtime: {
        policyThresholdMinutes: input.setup.attendancePolicy.overtimeAfterMinutes,
        pendingApprovals: overtimeApprovals.filter((item) => item.status === 'REQUESTED').length,
        dailyDetectedMinutes: overtimeMinutes,
        controls: [
          'Pre-approval required before payroll handoff',
          `Automatic overtime after ${input.setup.attendancePolicy.overtimeAfterMinutes} minutes`,
          ...input.setup.earningPolicies.filter((policy) => policy.active && policy.attendanceEvent === 'OVERTIME').map((policy) => `${policy.label} earning policy`),
        ],
      },
      lateEarly: {
        lateEmployees: rows.filter((row) => row.calculation.lateMinutes > 0).length,
        earlyDepartureProxyEmployees: rows.filter((row) => row.calculation.undertimeMinutes > 0 && row.latestCheckOutAt).length,
        graceMinutes: input.setup.attendancePolicy.lateGraceMinutes,
        deductionPolicies: input.setup.deductionPolicies
          .filter((policy) => policy.active && (policy.attendanceEvent === 'LATE' || policy.attendanceEvent === 'UNDERTIME'))
          .map((policy) => policy.label),
      },
      fatigueRisks,
      optimizationSuggestions,
    };
  }

  private buildCaptureChannels(setup: HcmSetupConfig): AttendanceCaptureChannelReadiness[] {
    return [
      {
        method: 'MOBILE_GEOFENCE',
        label: 'Mobile geofence',
        status: setup.attendancePolicy.geofenceEnabled ? 'ACTIVE' : 'NEEDS_CONFIGURATION',
        evidenceFields: ['latitude', 'longitude', 'accuracyMeters', 'workplaceCode', 'distanceMeters', 'trustScore'],
        policyDriven: true,
        message: setup.attendancePolicy.geofenceEnabled ? 'Policy validates workplace radius and trust score.' : 'Enable geofence policy for mobile check-in.',
      },
      {
        method: 'WEB_KIOSK',
        label: 'Kiosk / web terminal',
        status: hasActiveDeviceRule(setup, ['kiosk', 'browser']) ? 'ACTIVE' : 'NEEDS_CONFIGURATION',
        evidenceFields: ['deviceId', 'captureReference', 'verificationStatus'],
        policyDriven: true,
        message: 'Device trust rules classify approved kiosk/browser terminals.',
      },
      {
        method: 'BIOMETRIC_DEVICE',
        label: 'Biometric device',
        status: hasActiveDeviceRule(setup, ['bio', 'finger']) ? 'ACTIVE' : 'NOT_CONFIGURED',
        evidenceFields: ['captureReference', 'verificationStatus', 'captureEvidence.templateRef'],
        policyDriven: true,
        message: 'Use capture evidence references only; do not store biometric templates in HRM.',
      },
      {
        method: 'QR_CODE',
        label: 'QR attendance',
        status: hasActiveDeviceRule(setup, ['qr']) ? 'ACTIVE' : 'NOT_CONFIGURED',
        evidenceFields: ['captureReference', 'verificationStatus', 'captureEvidence.challengeId'],
        policyDriven: true,
        message: 'QR challenge/token references can be attached to clock events.',
      },
      {
        method: 'RFID_CARD',
        label: 'RFID / badge',
        status: hasActiveDeviceRule(setup, ['rfid', 'badge']) ? 'ACTIVE' : 'NOT_CONFIGURED',
        evidenceFields: ['captureReference', 'verificationStatus', 'deviceId'],
        policyDriven: true,
        message: 'Badge reader identity should map to a trusted device rule.',
      },
      {
        method: 'FACIAL_RECOGNITION',
        label: 'Facial recognition',
        status: hasActiveDeviceRule(setup, ['face', 'facial']) ? 'ACTIVE' : 'NOT_CONFIGURED',
        evidenceFields: ['captureReference', 'verificationStatus', 'captureEvidence.matchScore'],
        policyDriven: true,
        message: 'Facial verification should be enabled only where legally allowed.',
      },
      {
        method: 'MANUAL_CORRECTION',
        label: 'Manual correction',
        status: 'ACTIVE',
        evidenceFields: ['correctionRequestId', 'reviewedBy', 'appliedBy', 'reason'],
        policyDriven: true,
        message: 'Manual punches route through correction request approval and audit.',
      },
    ];
  }

  private buildSchedulePatterns(setup: HcmSetupConfig, rows: AttendanceLedgerRow[]): AttendanceSchedulingCommandCenter['schedulePatterns'] {
    const individualCount = rows.filter((row) => row.policyEvidence.schedule.source === 'INDIVIDUAL_SCHEDULE').length;
    return [
      {
        code: 'TENANT_DEFAULT',
        label: 'Default work week',
        type: 'TENANT_DEFAULT',
        active: true,
        details: `${setup.attendancePolicy.workDays?.length ?? 5} configured workday(s), ${setup.attendancePolicy.standardDailyMinutes} daily minutes`,
      },
      ...((setup.attendancePolicy.shiftRotations ?? []).map((rule) => ({
        code: rule.code,
        label: rule.label,
        type: 'SHIFT_ROTATION' as const,
        active: rule.active,
        details: `${rule.cycleDays}-day cycle, offsets ${rule.workDayOffsets.join(', ')}`,
      }))),
      ...((setup.attendancePolicy.flexibleHoursRules ?? []).map((rule) => ({
        code: rule.code,
        label: rule.label,
        type: 'FLEXIBLE_HOURS' as const,
        active: rule.active,
        details: `${rule.flexibleWindowStart ?? setup.attendancePolicy.flexibleWindowStart ?? 'n/a'}-${rule.flexibleWindowEnd ?? setup.attendancePolicy.flexibleWindowEnd ?? 'n/a'} flexible window`,
      }))),
      {
        code: 'INDIVIDUAL_SCHEDULES',
        label: 'Individual schedule assignments',
        type: 'INDIVIDUAL_SCHEDULE',
        active: individualCount > 0,
        details: `${individualCount} employee(s) resolved from individual work schedules today`,
      },
    ];
  }

  private buildCoverage(rows: AttendanceLedgerRow[]): AttendanceCoverageSignal[] {
    const byDepartment = new Map<string, AttendanceLedgerRow[]>();
    for (const row of rows) {
      const department = row.worker.departmentName ?? 'Unassigned';
      byDepartment.set(department, [...(byDepartment.get(department) ?? []), row]);
    }

    return [...byDepartment.entries()].map(([department, departmentRows]) => {
      const scheduled = departmentRows.filter((row) => row.scheduled).length;
      const present = departmentRows.filter(statusPresent).length;
      const absent = departmentRows.filter((row) => row.status === 'ABSENT').length;
      const onLeave = departmentRows.filter((row) => row.status === 'ON_LEAVE').length;
      const exceptionCount = departmentRows.reduce((total, row) => total + row.exceptions.length, 0);
      const overtimeMinutes = departmentRows.reduce((total, row) => total + row.payrollInput.overtimeMinutes, 0);
      const minimumStaffingTarget = Math.max(Math.ceil(scheduled * 0.85), scheduled > 0 ? 1 : 0);
      const gap = Math.max(minimumStaffingTarget - present, 0);
      const status: AttendanceCoverageSignal['status'] = gap > 0 ? 'GAP' : exceptionCount > 0 || overtimeMinutes > 0 ? 'WATCH' : 'COVERED';
      return {
        department,
        scheduled,
        present,
        absent,
        onLeave,
        exceptionCount,
        overtimeMinutes,
        minimumStaffingTarget,
        gap,
        status,
      };
    }).sort((left, right) => right.gap - left.gap || left.department.localeCompare(right.department));
  }

  private buildFatigueRisks(rows: AttendanceLedgerRow[], openShifts: OpenShift[]): AttendanceFatigueRisk[] {
    const risks: AttendanceFatigueRisk[] = [];
    for (const row of rows) {
      if (row.calculation.workedMinutes >= 720) {
        risks.push({
          workerId: row.worker.workerId,
          employeeId: row.worker.employeeId,
          workerName: row.worker.name,
          department: row.worker.departmentName,
          riskCode: 'EXCESSIVE_DAILY_HOURS',
          severity: 'HIGH',
          message: `${row.worker.name} worked ${Math.round(row.calculation.workedMinutes / 60)} hours on ${row.workDate}.`,
        });
      }
      if (row.payrollInput.overtimeMinutes >= 120) {
        risks.push({
          workerId: row.worker.workerId,
          employeeId: row.worker.employeeId,
          workerName: row.worker.name,
          department: row.worker.departmentName,
          riskCode: 'OVERTIME_SPIKE',
          severity: 'MEDIUM',
          message: `${row.worker.name} has ${row.payrollInput.overtimeMinutes} overtime minutes requiring approval.`,
        });
      }
      if (row.status === 'MISSING_CHECKOUT') {
        risks.push({
          workerId: row.worker.workerId,
          employeeId: row.worker.employeeId,
          workerName: row.worker.name,
          department: row.worker.departmentName,
          riskCode: 'MISSING_REST_EVIDENCE',
          severity: 'MEDIUM',
          message: 'Missing checkout prevents rest-period validation for the next roster assignment.',
        });
      }
    }

    for (const shift of openShifts.filter((item) => activeOpenShift(item.status))) {
      risks.push({
        workerId: '',
        employeeId: '',
        workerName: 'Unassigned shift',
        department: shift.departmentId.value,
        riskCode: 'UNSAFE_OPEN_SHIFT',
        severity: 'HIGH',
        message: `Open shift ${shift.id.value} must be filled with skill and rest checks before publishing coverage.`,
      });
    }
    return risks;
  }

  private buildOptimizationSuggestions(input: {
    rows: AttendanceLedgerRow[];
    captureChannels: AttendanceCaptureChannelReadiness[];
    coverage: AttendanceCoverageSignal[];
    openShifts: OpenShift[];
    coverageGaps: CoverageGap[];
    fatigueRisks: AttendanceFatigueRisk[];
  }): AttendanceOptimizationSuggestion[] {
    const suggestions: AttendanceOptimizationSuggestion[] = [];
    const uncovered = input.coverage.filter((item) => item.status === 'GAP');
    if (uncovered.length > 0 || input.coverageGaps.length > 0 || input.openShifts.length > 0) {
      suggestions.push({
        code: 'FILL_COVERAGE_GAPS',
        priority: 'HIGH',
        recommendation: 'Fill open shifts from available employees with matching skills before period close.',
        reason: `${uncovered.length + input.coverageGaps.length + input.openShifts.length} coverage signal(s) need action.`,
        action: 'Review open shifts, notify eligible workers, and require manager approval before assignment.',
      });
    }

    const overtimeRows = input.rows.filter((row) => row.payrollInput.overtimeMinutes > 0);
    if (overtimeRows.length > 0) {
      suggestions.push({
        code: 'REDISTRIBUTE_OVERTIME',
        priority: overtimeRows.some((row) => row.payrollInput.overtimeMinutes >= 120) ? 'HIGH' : 'MEDIUM',
        recommendation: 'Redistribute workload from employees with detected overtime to covered teams with spare capacity.',
        reason: `${overtimeRows.length} employee(s) have overtime minutes today.`,
        action: 'Approve valid overtime or adjust the next roster to reduce repeated overtime.',
      });
    }

    if (input.fatigueRisks.length > 0) {
      suggestions.push({
        code: 'PROTECT_REST_PERIODS',
        priority: input.fatigueRisks.some((risk) => risk.severity === 'HIGH') ? 'HIGH' : 'MEDIUM',
        recommendation: 'Block next-shift assignment for employees with fatigue risks until rest evidence is confirmed.',
        reason: `${input.fatigueRisks.length} fatigue or rest-period risk(s) detected.`,
        action: 'Use schedule approval to confirm rest interval, overtime cap, and night-shift recovery.',
      });
    }

    const missingChannels = input.captureChannels.filter((channel) => channel.status === 'NOT_CONFIGURED');
    if (missingChannels.length > 0) {
      suggestions.push({
        code: 'COMPLETE_CAPTURE_METHODS',
        priority: 'LOW',
        recommendation: 'Configure device trust rules for additional attendance capture methods used by the business.',
        reason: `${missingChannels.length} capture channel(s) are documented but not configured.`,
        action: 'Add trusted device rules for QR, RFID, biometric, or facial systems where legally permitted.',
      });
    }

    return suggestions;
  }
}
