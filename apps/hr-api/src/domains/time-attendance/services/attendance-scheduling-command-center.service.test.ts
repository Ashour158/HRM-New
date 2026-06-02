import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { DEFAULT_HCM_SETUP } from '../../hcm-setup/hcm-setup.defaults.js';
import { OpenShift } from '../../workforce-management/aggregates/open-shift.aggregate.js';
import { AttendanceSchedulingCommandCenterService } from './attendance-scheduling-command-center.service.js';
import type { AttendanceDailyLedger, AttendanceLedgerRow } from './attendance-ledger.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const departmentId = new Uuid('11111111-1111-1111-1111-111111111111');

function row(input: Partial<AttendanceLedgerRow> & { workerId: string; employeeId: string; name: string }): AttendanceLedgerRow {
  return {
    worker: {
      workerId: input.workerId,
      employeeId: input.employeeId,
      name: input.name,
      email: `${input.employeeId.toLowerCase()}@example.com`,
      departmentId: departmentId.value,
      departmentName: 'Operations',
      workLocationCode: 'CAIRO_HQ',
      status: 'ACTIVE',
    },
    workDate: '2026-05-25',
    status: input.status ?? 'OUT',
    scheduled: input.scheduled ?? true,
    firstCheckInAt: '2026-05-25T06:00:00.000Z',
    latestCheckOutAt: input.latestCheckOutAt ?? '2026-05-25T16:30:00.000Z',
    locationStatus: 'INSIDE_GEOFENCE',
    calculation: {
      workDate: '2026-05-25',
      workedMinutes: input.calculation?.workedMinutes ?? 630,
      payableMinutes: input.calculation?.payableMinutes ?? 630,
      lateMinutes: input.calculation?.lateMinutes ?? 0,
      undertimeMinutes: input.calculation?.undertimeMinutes ?? 0,
      overtimeMinutes: input.calculation?.overtimeMinutes ?? 150,
      onDutyMinutes: 0,
      absent: false,
      geofenceViolation: false,
      lowTrustPunch: false,
      events: [],
    },
    exceptions: [],
    payrollInput: {
      workDate: '2026-05-25',
      workedMinutes: input.payrollInput?.workedMinutes ?? 630,
      payableMinutes: input.payrollInput?.payableMinutes ?? 630,
      deductionMinutes: input.payrollInput?.deductionMinutes ?? 0,
      overtimeMinutes: input.payrollInput?.overtimeMinutes ?? 150,
      readyForPayroll: true,
      locked: false,
      source: 'ATTENDANCE_DAILY_LEDGER',
    },
    policyEvidence: {
      schedule: { source: 'TENANT_DEFAULT' },
      trust: { minClockTrustScore: 70, lowTrustBlocksPayroll: true },
    },
    governance: {
      visibilityScope: 'HR_ADMIN',
      locationDataClassification: 'CONFIDENTIAL',
      payrollDataClassification: 'CONFIDENTIAL',
    },
  };
}

describe('AttendanceSchedulingCommandCenterService', () => {
  it('connects ledger, coverage, overtime, fatigue, capture policy, and optimization signals', () => {
    const service = new AttendanceSchedulingCommandCenterService();
    const ledger: AttendanceDailyLedger = {
      workDate: '2026-05-25',
      rows: [
        row({ workerId: '22222222-2222-2222-2222-222222222222', employeeId: 'EMP-001', name: 'Mona Ali' }),
        row({
          workerId: '33333333-3333-3333-3333-333333333333',
          employeeId: 'EMP-002',
          name: 'Omar Samir',
          status: 'ABSENT',
          firstCheckInAt: undefined,
          latestCheckOutAt: undefined,
          calculation: { workedMinutes: 0, payableMinutes: 0, lateMinutes: 0, undertimeMinutes: 480, overtimeMinutes: 0 } as AttendanceLedgerRow['calculation'],
          payrollInput: { workedMinutes: 0, payableMinutes: 0, deductionMinutes: 480, overtimeMinutes: 0 } as AttendanceLedgerRow['payrollInput'],
        }),
      ],
      summary: {
        absent: 1,
        exceptions: 1,
        geofenceViolations: 0,
        inProgress: 0,
        late: 0,
        missingCheckout: 0,
        onLeave: 0,
        payrollReady: 1,
        present: 1,
        totalEmployees: 2,
        undertime: 1,
      },
      exceptionQueue: [],
    };
    const openShift = OpenShift.create({
      id: new Uuid('44444444-4444-4444-4444-444444444444'),
      tenantId,
      departmentId,
      shiftDate: new Date('2026-05-25T00:00:00.000Z'),
      startTime: new Date('2026-05-25T18:00:00.000Z'),
      endTime: new Date('2026-05-26T02:00:00.000Z'),
      workplaceCode: 'CAIRO_HQ',
      requiredSkills: ['ICU_LICENSE'],
    }, Uuid.generate());
    const remoteOpenShift = OpenShift.create({
      id: new Uuid('55555555-5555-5555-5555-555555555555'),
      tenantId,
      departmentId,
      shiftDate: new Date('2026-05-25T00:00:00.000Z'),
      startTime: new Date('2026-05-25T18:00:00.000Z'),
      endTime: new Date('2026-05-26T02:00:00.000Z'),
      workplaceCode: 'ALEX_BRANCH',
      requiredSkills: ['ICU_LICENSE'],
    }, Uuid.generate());
    const unscopedOpenShift = OpenShift.create({
      id: new Uuid('66666666-6666-6666-6666-666666666666'),
      tenantId,
      departmentId,
      shiftDate: new Date('2026-05-25T00:00:00.000Z'),
      startTime: new Date('2026-05-25T18:00:00.000Z'),
      endTime: new Date('2026-05-26T02:00:00.000Z'),
      requiredSkills: ['ICU_LICENSE'],
    }, Uuid.generate());

    const result = service.build({
      setup: DEFAULT_HCM_SETUP,
      ledger,
      openShifts: [openShift, remoteOpenShift, unscopedOpenShift],
      coverageGaps: [],
      overtimeApprovals: [],
      shiftSchedules: [],
      workplaceCode: 'CAIRO_HQ',
    });

    expect(result.status).toBe('AT_RISK');
    expect(result.summary.openShiftCount).toBe(1);
    expect(result.roster.openShifts).toEqual([
      expect.objectContaining({ id: openShift.id.value, workplaceCode: 'CAIRO_HQ' }),
    ]);
    expect(result.summary.overtimeMinutes).toBe(150);
    expect(result.captureChannels.find((channel) => channel.method === 'MOBILE_GEOFENCE')?.status).toBe('ACTIVE');
    expect(result.coverage[0]).toMatchObject({ department: 'Operations', status: 'GAP', gap: 1 });
    expect(result.fatigueRisks.some((risk) => risk.riskCode === 'OVERTIME_SPIKE')).toBe(true);
    expect(result.optimizationSuggestions.map((item) => item.code)).toEqual(
      expect.arrayContaining(['FILL_COVERAGE_GAPS', 'REDISTRIBUTE_OVERTIME', 'PROTECT_REST_PERIODS']),
    );
  });
});
