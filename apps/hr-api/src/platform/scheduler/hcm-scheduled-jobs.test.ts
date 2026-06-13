import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { JobContext } from './scheduled-job.js';
import type { ReminderEmitter, ReminderEmitterInput } from './reminder-emitter.js';
import {
  AttendanceAnomalyAlertJob,
  AttendanceDailyFinalizationJob,
  LeaveAccrualRunJob,
  LeaveApprovalSlaJob,
  LeaveBalanceExpiryAlertJob,
  LeaveCarryoverRunJob,
  PayrollCutoffReminderJob,
  PayrollCycleOpenJob,
  PayrollReadinessCheckJob,
  ReturnToWorkReminderJob,
  TimesheetApprovalSlaJob,
  TimesheetSubmissionReminderJob,
} from './hcm-scheduled-jobs.js';

const tenantId = new Uuid('00000000-0000-4000-8000-000000000001');
const workerId = new Uuid('00000000-0000-4000-8000-000000000101');
const managerId = new Uuid('00000000-0000-4000-8000-000000000201');
const payrollAdminId = new Uuid('00000000-0000-4000-8000-000000000301');

function makeContext(now = new Date('2026-06-14T08:00:00.000Z')) {
  const commands: Array<Parameters<JobContext['runCommand']>[0]> = [];
  const ctx: JobContext = {
    tenantId,
    timezone: 'Africa/Cairo',
    periodKey: 'test-period',
    now,
    actor: {
      actorId: new Uuid('00000000-0000-4000-8000-000000000999'),
      actorType: 'SERVICE_ACCOUNT',
      roles: ['SYSTEM'],
      permissions: ['SCHEDULER_RUN'],
    },
    jobName: 'test-job',
    runCommand: vi.fn(async (input) => {
      commands.push(input);
      return { success: true };
    }),
  };
  return { ctx, commands };
}

function setupService() {
  return {
    getSetup: vi.fn(async () => ({
      timezone: 'Africa/Cairo',
      leavePolicies: [
        {
          code: 'VACATION',
          label: 'Annual leave',
          active: true,
          unit: 'DAYS',
          paid: true,
          deductFromBalance: true,
          requestableByEmployee: true,
          payrollImpact: 'PAID_LEAVE',
          approvalWorkflow: 'MANAGER',
          annualEntitlement: 24,
          minNoticeDays: 2,
        },
      ],
      attendancePolicy: {
        standardDailyMinutes: 480,
        flexibleHoursEnabled: false,
        lateGraceMinutes: 15,
        overtimeAfterMinutes: 480,
        geofenceEnabled: false,
      },
      payrollCalculationPolicy: {
        taxRatePercent: 10,
        employeeInsuranceRatePercent: 5,
      },
      statutoryPayrollPacks: [],
      salaryCompositionPlans: [],
      earningPolicies: [],
      deductionPolicies: [],
      payrollBlockingRules: [],
    })),
  };
}

function reminderEmitter() {
  const emitted: ReminderEmitterInput[] = [];
  return {
    emitted,
    emitter: {
      emit: vi.fn(async (input: ReminderEmitterInput) => {
        emitted.push(input);
        return { status: 'PUBLISHED' as const, dispatchKey: `${input.reminderType}:${input.subject.subjectId.value}` };
      }),
    } as unknown as ReminderEmitter,
  };
}

describe('HCM scheduled jobs', () => {
  it('leave-accrual-run accrues active balances once per month through UpdateAbsenceAccrualBalance', async () => {
    const { ctx, commands } = makeContext(new Date('2026-06-01T08:00:00.000Z'));
    const job = new LeaveAccrualRunJob({
      findActiveAccrualBalances: vi.fn(async () => [{
        id: new Uuid('00000000-0000-4000-8000-000000000111'),
        workerId,
        leaveType: 'VACATION',
        balanceHours: 8,
        accruedHours: 16,
        usedHours: 0,
        status: 'ACTIVE',
        aggregateVersion: 3,
      }]),
    }, setupService() as never);

    expect(job.periodKey?.(ctx.now, ctx.timezone)).toBe('2026-06');
    await expect(job.runForTenant(ctx)).resolves.toMatchObject({ itemsProcessed: 1 });
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      commandName: 'UpdateAbsenceAccrualBalance',
      aggregateType: 'AbsenceAccrualBalance',
      payload: { balanceHours: 24, accruedHours: 32 },
    });
  });

  it('leave-carryover-run dispatches CarryOverAbsenceAccrualBalance with annual period key', async () => {
    const { ctx, commands } = makeContext(new Date('2026-12-31T22:00:00.000Z'));
    const balanceId = new Uuid('00000000-0000-4000-8000-000000000112');
    const job = new LeaveCarryoverRunJob({
      findCarryoverBalances: vi.fn(async () => [{ id: balanceId, workerId, leaveType: 'VACATION', status: 'ACTIVE', aggregateVersion: 4 }]),
    }, setupService() as never);

    expect(job.periodKey?.(ctx.now, ctx.timezone)).toBe('2026');
    await expect(job.runForTenant(ctx)).resolves.toMatchObject({ itemsProcessed: 1 });
    expect(commands[0]).toMatchObject({
      commandName: 'CarryOverAbsenceAccrualBalance',
      aggregateType: 'AbsenceAccrualBalance',
      payload: { balanceId },
    });
  });

  it('leave-balance-expiry-alert emits ReminderDue for negative or expiring balances', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new LeaveBalanceExpiryAlertJob({
      findBalanceAlerts: vi.fn(async () => [{
        balanceId: new Uuid('00000000-0000-4000-8000-000000000113'),
        workerId,
        leaveType: 'VACATION',
        reason: 'NEGATIVE_BALANCE',
        dueDate: new Date('2026-06-14T00:00:00.000Z'),
      }]),
    }, emitter, setupService() as never);

    await expect(job.runForTenant(ctx)).resolves.toMatchObject({ itemsProcessed: 1 });
    expect(emitted[0]).toMatchObject({ reminderType: 'LEAVE_BALANCE_ALERT', audienceWorkerIds: [workerId] });
  });

  it('leave-approval-sla escalates overdue leave approvals to approver then manager', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new LeaveApprovalSlaJob({
      findApprovalSlaBreaches: vi.fn(async () => [{
        requestId: new Uuid('00000000-0000-4000-8000-000000000114'),
        workerId,
        approverWorkerId: managerId,
        approverManagerWorkerId: payrollAdminId,
        submittedAt: new Date('2026-06-10T00:00:00.000Z'),
        dueDate: new Date('2026-06-12T00:00:00.000Z'),
        daysOverdue: 2,
      }]),
    }, emitter, setupService() as never);

    await expect(job.runForTenant(ctx)).resolves.toMatchObject({ itemsProcessed: 1 });
    expect(emitted[0]).toMatchObject({
      reminderType: 'LEAVE_APPROVAL_SLA',
      audienceWorkerIds: [managerId],
      managerAudienceWorkerIds: [payrollAdminId],
      escalationTier: { code: 'T_PLUS_2', escalateToManager: true },
    });
  });

  it('return-to-work-reminder reminds workers before planned return date', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new ReturnToWorkReminderJob({
      findUpcomingReturnToWorkCases: vi.fn(async () => [{
        leaveCaseId: new Uuid('00000000-0000-4000-8000-000000000115'),
        workerId,
        managerWorkerId: managerId,
        expectedReturnDate: new Date('2026-06-16T00:00:00.000Z'),
      }]),
    }, emitter, setupService() as never);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({
      reminderType: 'RETURN_TO_WORK_REMINDER',
      audienceWorkerIds: [workerId],
      managerAudienceWorkerIds: [managerId],
    });
  });

  it('attendance-daily-finalization finalizes the prior business day through FinalizeAttendanceDailyLedger', async () => {
    const { ctx, commands } = makeContext(new Date('2026-06-14T20:00:00.000Z'));
    const job = new AttendanceDailyFinalizationJob({
      findFinalizationTargets: vi.fn(async () => [{ workplaceCode: 'CAIRO_HQ', workerCount: 12 }]),
    }, setupService() as never);

    expect(job.periodKey?.(ctx.now, ctx.timezone)).toBe('2026-06-13');
    await job.runForTenant(ctx);
    expect(commands[0]).toMatchObject({
      commandName: 'FinalizeAttendanceDailyLedger',
      aggregateType: 'AttendanceDailyLedger',
      payload: { date: '2026-06-13', workplaceCode: 'CAIRO_HQ' },
    });
  });

  it('timesheet-submission-reminder reminds workers with unsubmitted timesheets', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new TimesheetSubmissionReminderJob({
      findUnsubmittedTimesheets: vi.fn(async () => [{
        workerId,
        timesheetId: new Uuid('00000000-0000-4000-8000-000000000116'),
        periodEnd: new Date('2026-06-15T00:00:00.000Z'),
      }]),
    }, emitter, setupService() as never);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'TIMESHEET_SUBMISSION_REMINDER', audienceWorkerIds: [workerId] });
  });

  it('timesheet-approval-sla escalates submitted timesheets past SLA', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new TimesheetApprovalSlaJob({
      findTimesheetApprovalSlaBreaches: vi.fn(async () => [{
        timesheetId: new Uuid('00000000-0000-4000-8000-000000000117'),
        workerId,
        approverWorkerId: managerId,
        submittedAt: new Date('2026-06-10T00:00:00.000Z'),
        dueDate: new Date('2026-06-12T00:00:00.000Z'),
        daysOverdue: 2,
      }]),
    }, emitter, setupService() as never);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'TIMESHEET_APPROVAL_SLA', audienceWorkerIds: [managerId] });
  });

  it('attendance-anomaly-alert emits reminders for missing punches and overtime anomalies', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new AttendanceAnomalyAlertJob({
      findAttendanceAnomalies: vi.fn(async () => [{
        anomalyId: new Uuid('00000000-0000-4000-8000-000000000118'),
        workerId,
        managerWorkerId: managerId,
        anomalyType: 'MISSING_PUNCH',
        workDate: '2026-06-13',
        severity: 'WARNING',
      }]),
    }, emitter, setupService() as never);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'ATTENDANCE_ANOMALY_ALERT', audienceWorkerIds: [workerId], managerAudienceWorkerIds: [managerId] });
  });

  it('payroll-cycle-open creates the due draft payroll cycle with monthly period key', async () => {
    const { ctx, commands } = makeContext(new Date('2026-06-25T06:00:00.000Z'));
    const job = new PayrollCycleOpenJob({
      findCyclesToOpen: vi.fn(async () => [{
        cycleName: 'June 2026 payroll',
        payPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
        payPeriodEnd: new Date('2026-06-30T00:00:00.000Z'),
        payDate: new Date('2026-07-01T00:00:00.000Z'),
      }]),
    }, setupService() as never);

    expect(job.periodKey?.(ctx.now, ctx.timezone)).toBe('2026-06');
    await job.runForTenant(ctx);
    expect(commands[0]).toMatchObject({
      commandName: 'CreatePayrollCycle',
      aggregateType: 'PayrollCycle',
      payload: { cycleName: 'June 2026 payroll' },
    });
  });

  it('payroll-cutoff-reminder emits T-minus reminders for unfinished payroll inputs', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new PayrollCutoffReminderJob({
      findCutoffReminderItems: vi.fn(async () => [{
        payrollCycleId: new Uuid('00000000-0000-4000-8000-000000000119'),
        payrollAdminWorkerIds: [payrollAdminId],
        cycleName: 'June 2026 payroll',
        cutoffDate: new Date('2026-06-17T00:00:00.000Z'),
        inputsNotFinalized: 4,
        daysUntilCutoff: 3,
      }]),
    }, emitter, setupService() as never);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({
      reminderType: 'PAYROLL_CUTOFF_REMINDER',
      audienceWorkerIds: [payrollAdminId],
      escalationTier: { code: 'T_MINUS_3' },
    });
  });

  it('payroll-readiness-check alerts admins about missing worker inputs', async () => {
    const { ctx } = makeContext();
    const { emitter, emitted } = reminderEmitter();
    const job = new PayrollReadinessCheckJob({
      findReadinessIssues: vi.fn(async () => [{
        payrollCycleId: new Uuid('00000000-0000-4000-8000-000000000120'),
        workerId,
        payrollAdminWorkerIds: [payrollAdminId],
        issueType: 'MISSING_BANK_INFO',
        dueDate: new Date('2026-06-20T00:00:00.000Z'),
      }]),
    }, emitter, setupService() as never);

    await job.runForTenant(ctx);
    expect(emitted[0]).toMatchObject({ reminderType: 'PAYROLL_READINESS_CHECK', audienceWorkerIds: [payrollAdminId] });
  });
});
