import { Inject, Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { HcmSetupService } from '../../domains/hcm-setup/hcm-setup.service.js';
import type { HcmSetupConfig, LeavePolicy, PolicyRuleLedger } from '../../domains/hcm-setup/hcm-setup.types.js';
import type { JobContext, JobOutcome, ScheduledJob } from './scheduled-job.js';
import { ReminderEmitter } from './reminder-emitter.js';
import type { ReminderEscalationTier } from './reminder-emitter.js';
import { EffectiveDatingActivator } from './effective-dating-activator.js';
import type { EffectiveDatingCandidate } from './effective-dating-activator.js';

export interface AccrualBalanceJobRecord {
  id: Uuid;
  workerId: Uuid;
  leaveType: string;
  balanceHours: number;
  accruedHours: number;
  usedHours: number;
  status: string;
  aggregateVersion?: number;
}

export interface CarryoverBalanceJobRecord {
  id: Uuid;
  workerId: Uuid;
  leaveType: string;
  status: string;
  aggregateVersion?: number;
}

export interface LeaveBalanceAlertRecord {
  balanceId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  leaveType: string;
  reason: 'EXPIRING_SOON' | 'NEGATIVE_BALANCE';
  dueDate: Date;
  balanceHours?: number;
}

export interface LeaveApprovalSlaRecord {
  requestId: Uuid;
  workerId: Uuid;
  approverWorkerId: Uuid;
  approverManagerWorkerId?: Uuid;
  submittedAt: Date;
  dueDate: Date;
  daysOverdue: number;
}

export interface ReturnToWorkRecord {
  leaveCaseId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  expectedReturnDate: Date;
}

export interface LeaveSchedulerRepositoryPort {
  findActiveAccrualBalances(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<AccrualBalanceJobRecord[]>;
  findCarryoverBalances(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<CarryoverBalanceJobRecord[]>;
  findBalanceAlerts(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<LeaveBalanceAlertRecord[]>;
  findApprovalSlaBreaches(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<LeaveApprovalSlaRecord[]>;
  findUpcomingReturnToWorkCases(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<ReturnToWorkRecord[]>;
}

export interface AttendanceFinalizationTarget {
  workplaceCode?: string;
  workerCount: number;
}

export interface TimesheetSubmissionRecord {
  timesheetId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  periodEnd: Date;
}

export interface TimesheetApprovalSlaRecord {
  timesheetId: Uuid;
  workerId: Uuid;
  approverWorkerId: Uuid;
  approverManagerWorkerId?: Uuid;
  submittedAt: Date;
  dueDate: Date;
  daysOverdue: number;
}

export interface AttendanceAnomalyRecord {
  anomalyId: Uuid;
  workerId: Uuid;
  managerWorkerId?: Uuid;
  anomalyType: string;
  workDate: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface AttendanceSchedulerRepositoryPort {
  findFinalizationTargets(input: { tenantId: Uuid; targetDate: string; now: Date; setup: HcmSetupConfig }): Promise<AttendanceFinalizationTarget[]>;
  findUnsubmittedTimesheets(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<TimesheetSubmissionRecord[]>;
  findTimesheetApprovalSlaBreaches(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<TimesheetApprovalSlaRecord[]>;
  findAttendanceAnomalies(input: { tenantId: Uuid; targetDate: string; now: Date; setup: HcmSetupConfig }): Promise<AttendanceAnomalyRecord[]>;
}

export interface PayrollCycleOpenRecord {
  cycleName: string;
  payPeriodStart: Date;
  payPeriodEnd: Date;
  payDate?: Date;
}

export interface PayrollCutoffReminderRecord {
  payrollCycleId: Uuid;
  payrollAdminWorkerIds: Uuid[];
  cycleName: string;
  cutoffDate: Date;
  inputsNotFinalized: number;
  daysUntilCutoff: number;
}

export interface PayrollReadinessIssueRecord {
  payrollCycleId: Uuid;
  workerId: Uuid;
  payrollAdminWorkerIds: Uuid[];
  issueType: string;
  dueDate: Date;
}

export interface PayrollSchedulerRepositoryPort {
  findCyclesToOpen(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<PayrollCycleOpenRecord[]>;
  findCutoffReminderItems(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<PayrollCutoffReminderRecord[]>;
  findReadinessIssues(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<PayrollReadinessIssueRecord[]>;
}

@Injectable()
export class HcmSchedulerReadRepository implements LeaveSchedulerRepositoryPort, AttendanceSchedulerRepositoryPort, PayrollSchedulerRepositoryPort {
  private readonly db = createKyselyInstance(getPool());

  async findActiveAccrualBalances(input: { tenantId: Uuid }): Promise<AccrualBalanceJobRecord[]> {
    const rows = await this.db
      .selectFrom('absence_accrual_balances')
      .select(['id', 'worker_id', 'leave_type', 'balance_hours', 'accrued_hours', 'used_hours', 'status', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .execute();
    return rows.map((row) => ({
      id: new Uuid(row.id),
      workerId: new Uuid(row.worker_id),
      leaveType: row.leave_type,
      balanceHours: Number(row.balance_hours),
      accruedHours: Number(row.accrued_hours),
      usedHours: Number(row.used_hours),
      status: row.status,
      aggregateVersion: row.aggregate_version,
    }));
  }

  async findCarryoverBalances(input: { tenantId: Uuid }): Promise<CarryoverBalanceJobRecord[]> {
    const rows = await this.db
      .selectFrom('absence_accrual_balances')
      .select(['id', 'worker_id', 'leave_type', 'status', 'aggregate_version'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .execute();
    return rows.map((row) => ({
      id: new Uuid(row.id),
      workerId: new Uuid(row.worker_id),
      leaveType: row.leave_type,
      status: row.status,
      aggregateVersion: row.aggregate_version,
    }));
  }

  async findBalanceAlerts(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<LeaveBalanceAlertRecord[]> {
    const soon = addDays(input.now, numberSetting(input.setup, 'leaveBalanceExpiryAlertDays', 30));
    const rows = await this.db
      .selectFrom('absence_accrual_balances as balance')
      .leftJoin('workers as worker', 'worker.id', 'balance.worker_id')
      .select([
        'balance.id as balance_id',
        'balance.worker_id',
        'balance.leave_type',
        'balance.balance_hours',
        'balance.effective_date',
        'worker.manager_id',
      ])
      .where('balance.tenant_id', '=', input.tenantId.value)
      .where('balance.status', '=', 'ACTIVE')
      .where((eb) => eb.or([
        eb('balance.balance_hours', '<', 0),
        eb('balance.effective_date', '<=', soon),
      ]))
      .execute();
    return rows.map((row) => ({
      balanceId: new Uuid(row.balance_id),
      workerId: new Uuid(row.worker_id),
      managerWorkerId: row.manager_id ? new Uuid(row.manager_id) : undefined,
      leaveType: row.leave_type,
      reason: Number(row.balance_hours) < 0 ? 'NEGATIVE_BALANCE' : 'EXPIRING_SOON',
      dueDate: row.effective_date,
      balanceHours: Number(row.balance_hours),
    }));
  }

  async findApprovalSlaBreaches(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<LeaveApprovalSlaRecord[]> {
    const slaDays = numberSetting(input.setup, 'leaveApprovalSlaDays', 2);
    const dueBefore = addDays(input.now, -slaDays);
    const rows = await this.db
      .selectFrom('absence_requests as request')
      .innerJoin('workers as worker', 'worker.id', 'request.worker_id')
      .leftJoin('workers as manager', 'manager.id', 'worker.manager_id')
      .select([
        'request.id as request_id',
        'request.worker_id',
        'request.submitted_at',
        'worker.manager_id as approver_worker_id',
        'manager.manager_id as approver_manager_worker_id',
      ])
      .where('request.tenant_id', '=', input.tenantId.value)
      .where('request.status', '=', 'PENDING_APPROVAL')
      .where('request.submitted_at', '<=', dueBefore)
      .where('worker.manager_id', 'is not', null)
      .execute();
    return rows.flatMap((row) => {
      if (!row.submitted_at || !row.approver_worker_id) return [];
      const dueDate = addDays(row.submitted_at, slaDays);
      return [{
        requestId: new Uuid(row.request_id),
        workerId: new Uuid(row.worker_id),
        approverWorkerId: new Uuid(row.approver_worker_id),
        approverManagerWorkerId: row.approver_manager_worker_id ? new Uuid(row.approver_manager_worker_id) : undefined,
        submittedAt: row.submitted_at,
        dueDate,
        daysOverdue: daysBetween(dueDate, input.now),
      }];
    });
  }

  async findUpcomingReturnToWorkCases(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<ReturnToWorkRecord[]> {
    const horizon = addDays(input.now, numberSetting(input.setup, 'returnToWorkReminderDays', 3));
    const rows = await this.db
      .selectFrom('leave_cases as leave_case')
      .leftJoin('workers as worker', 'worker.id', 'leave_case.worker_id')
      .select(['leave_case.id', 'leave_case.worker_id', 'leave_case.expected_return_date', 'worker.manager_id'])
      .where('leave_case.tenant_id', '=', input.tenantId.value)
      .where('leave_case.status', 'in', ['ACTIVE', 'RETURN_TO_WORK'])
      .where('leave_case.expected_return_date', 'is not', null)
      .where('leave_case.expected_return_date', '<=', horizon)
      .where('leave_case.expected_return_date', '>=', startOfLocalDay(input.now))
      .execute();
    return rows.flatMap((row) => row.expected_return_date ? [{
      leaveCaseId: new Uuid(row.id),
      workerId: new Uuid(row.worker_id),
      managerWorkerId: row.manager_id ? new Uuid(row.manager_id) : undefined,
      expectedReturnDate: row.expected_return_date,
    }] : []);
  }

  async findFinalizationTargets(input: { tenantId: Uuid; targetDate: string }): Promise<AttendanceFinalizationTarget[]> {
    const existingRows = await this.db
      .selectFrom('attendance_daily_ledgers')
      .select(['worker_id'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('work_date', '=', dbDate(input.targetDate))
      .where('locked', '=', true)
      .execute();
    if (existingRows.length > 0) return [];
    const activeWorkers = await this.db
      .selectFrom('workers')
      .select(({ fn }) => [fn.countAll<string>().as('worker_count')])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst();
    const workerCount = Number(activeWorkers?.worker_count ?? 0);
    return workerCount > 0 ? [{ workerCount }] : [];
  }

  async findUnsubmittedTimesheets(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<TimesheetSubmissionRecord[]> {
    const cutoffDays = numberSetting(input.setup, 'timesheetSubmissionReminderDays', 1);
    const dueBefore = addDays(input.now, cutoffDays);
    const rows = await this.db
      .selectFrom('timesheets as timesheet')
      .leftJoin('workers as worker', 'worker.id', 'timesheet.worker_id')
      .select(['timesheet.id', 'timesheet.worker_id', 'timesheet.period_end', 'worker.manager_id'])
      .where('timesheet.tenant_id', '=', input.tenantId.value)
      .where('timesheet.status', 'in', ['DRAFT', 'CORRECTED'])
      .where('timesheet.period_end', '<=', dueBefore)
      .execute();
    return rows.map((row) => ({
      timesheetId: new Uuid(row.id),
      workerId: new Uuid(row.worker_id),
      managerWorkerId: row.manager_id ? new Uuid(row.manager_id) : undefined,
      periodEnd: row.period_end,
    }));
  }

  async findTimesheetApprovalSlaBreaches(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<TimesheetApprovalSlaRecord[]> {
    const slaDays = numberSetting(input.setup, 'timesheetApprovalSlaDays', 2);
    const dueBefore = addDays(input.now, -slaDays);
    const rows = await this.db
      .selectFrom('timesheets as timesheet')
      .innerJoin('workers as worker', 'worker.id', 'timesheet.worker_id')
      .leftJoin('workers as manager', 'manager.id', 'worker.manager_id')
      .select([
        'timesheet.id',
        'timesheet.worker_id',
        'timesheet.submitted_at',
        'worker.manager_id as approver_worker_id',
        'manager.manager_id as approver_manager_worker_id',
      ])
      .where('timesheet.tenant_id', '=', input.tenantId.value)
      .where('timesheet.status', '=', 'SUBMITTED')
      .where('timesheet.submitted_at', '<=', dueBefore)
      .where('worker.manager_id', 'is not', null)
      .execute();
    return rows.flatMap((row) => {
      if (!row.submitted_at || !row.approver_worker_id) return [];
      const dueDate = addDays(row.submitted_at, slaDays);
      return [{
        timesheetId: new Uuid(row.id),
        workerId: new Uuid(row.worker_id),
        approverWorkerId: new Uuid(row.approver_worker_id),
        approverManagerWorkerId: row.approver_manager_worker_id ? new Uuid(row.approver_manager_worker_id) : undefined,
        submittedAt: row.submitted_at,
        dueDate,
        daysOverdue: daysBetween(dueDate, input.now),
      }];
    });
  }

  async findAttendanceAnomalies(input: { tenantId: Uuid; targetDate: string; setup: HcmSetupConfig }): Promise<AttendanceAnomalyRecord[]> {
    const rows = await this.db
      .selectFrom('attendance_daily_ledgers as ledger')
      .leftJoin('workers as worker', 'worker.id', 'ledger.worker_id')
      .select([
        'ledger.id',
        'ledger.worker_id',
        'ledger.status',
        'ledger.overtime_minutes',
        'ledger.exception_count',
        'worker.manager_id',
      ])
      .where('ledger.tenant_id', '=', input.tenantId.value)
      .where('ledger.work_date', '=', dbDate(input.targetDate))
      .where((eb) => eb.or([
        eb('ledger.status', 'in', ['MISSING_PUNCH', 'ABSENT']),
        eb('ledger.overtime_minutes', '>=', numberSetting(input.setup, 'attendanceAnomalyOvertimeMinutes', 180)),
        eb('ledger.exception_count', '>', 0),
      ]))
      .execute();
    return rows.map((row) => ({
      anomalyId: new Uuid(row.id),
      workerId: new Uuid(row.worker_id),
      managerWorkerId: row.manager_id ? new Uuid(row.manager_id) : undefined,
      anomalyType: row.status === 'MISSING_PUNCH' || row.status === 'ABSENT' ? row.status : 'OVERTIME_OR_EXCEPTION',
      workDate: input.targetDate,
      severity: Number(row.exception_count) > 0 ? 'CRITICAL' : 'WARNING',
    }));
  }

  async findCyclesToOpen(input: { tenantId: Uuid; now: Date }): Promise<PayrollCycleOpenRecord[]> {
    const month = monthPeriodKey(input.now);
    const periodStart = new Date(`${month}-01T00:00:00.000Z`);
    const periodEnd = endOfMonth(periodStart);
    const existing = await this.db
      .selectFrom('payroll_cycles')
      .select(['id'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('pay_period_start', '=', periodStart)
      .where('pay_period_end', '=', periodEnd)
      .executeTakeFirst();
    if (existing) return [];
    return [{
      cycleName: `${month} payroll`,
      payPeriodStart: periodStart,
      payPeriodEnd: periodEnd,
      payDate: addDays(periodEnd, 1),
    }];
  }

  async findCutoffReminderItems(input: { tenantId: Uuid; now: Date; setup: HcmSetupConfig }): Promise<PayrollCutoffReminderRecord[]> {
    const adminIds = await this.findPayrollAdminWorkerIds(input.tenantId);
    if (adminIds.length === 0) return [];
    const rows = await this.db
      .selectFrom('payroll_cycles as cycle')
      .leftJoin('payroll_inputs as input', 'input.payroll_cycle_id', 'cycle.id')
      .select(({ fn }) => [
        'cycle.id',
        'cycle.cycle_name',
        'cycle.pay_period_end',
        fn.count<string>('input.id').filterWhere('input.status', '!=', 'APPROVED').as('inputs_not_finalized'),
      ])
      .where('cycle.tenant_id', '=', input.tenantId.value)
      .where('cycle.status', 'in', ['INPUT_COLLECTION', 'VALIDATION'])
      .groupBy(['cycle.id', 'cycle.cycle_name', 'cycle.pay_period_end'])
      .execute();
    return rows.flatMap((row) => {
      const cutoffDate = addDays(row.pay_period_end, -numberSetting(input.setup, 'payrollCutoffDaysBeforePeriodEnd', 3));
      const daysUntilCutoff = daysBetween(input.now, cutoffDate);
      if (![3, 1, 0].includes(daysUntilCutoff)) return [];
      return [{
        payrollCycleId: new Uuid(row.id),
        payrollAdminWorkerIds: adminIds,
        cycleName: row.cycle_name,
        cutoffDate,
        inputsNotFinalized: Number(row.inputs_not_finalized ?? 0),
        daysUntilCutoff,
      }];
    });
  }

  async findReadinessIssues(input: { tenantId: Uuid; now: Date }): Promise<PayrollReadinessIssueRecord[]> {
    const adminIds = await this.findPayrollAdminWorkerIds(input.tenantId);
    if (adminIds.length === 0) return [];
    const cycle = await this.db
      .selectFrom('payroll_cycles')
      .select(['id', 'pay_period_end'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', 'in', ['INPUT_COLLECTION', 'VALIDATION', 'CALCULATION'])
      .orderBy('pay_period_end', 'asc')
      .executeTakeFirst();
    if (!cycle) return [];
    const workers = await this.db
      .selectFrom('workers')
      .select(['id'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('status', '=', 'ACTIVE')
      .limit(200)
      .execute();
    const issues: PayrollReadinessIssueRecord[] = [];
    for (const worker of workers) {
      const records = await this.db
        .selectFrom('personal_data_records')
        .select(['id', 'payload'])
        .where('tenant_id', '=', input.tenantId.value)
        .where('worker_id', '=', worker.id)
        .where('data_category', 'in', ['BASIC', 'PAYROLL'])
        .execute();
      const hasBank = records.some((record) => objectHasKey(record.payload, 'bankAccount'));
      const hasTax = records.some((record) => objectHasKey(record.payload, 'taxProfile'));
      if (!hasBank || !hasTax) {
        issues.push({
          payrollCycleId: new Uuid(cycle.id),
          workerId: new Uuid(worker.id),
          payrollAdminWorkerIds: adminIds,
          issueType: !hasBank ? 'MISSING_BANK_INFO' : 'MISSING_TAX_PROFILE',
          dueDate: cycle.pay_period_end,
        });
      }
    }
    return issues;
  }

  private async findPayrollAdminWorkerIds(tenantId: Uuid): Promise<Uuid[]> {
    const rows = await this.db
      .selectFrom('workers')
      .select(['id'])
      .where('tenant_id', '=', tenantId.value)
      .where('status', '=', 'ACTIVE')
      .where('job_title', 'ilike', '%payroll%')
      .limit(20)
      .execute();
    return rows.map((row) => new Uuid(row.id));
  }
}

@Injectable()
export class LeaveAccrualRunJob implements ScheduledJob {
  readonly name = 'leave-accrual-run';
  readonly cron = '0 2 * * *';
  readonly permissions = ['LEAVE_BALANCE_UPDATE'];
  readonly periodKey = monthPeriodKey;

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<LeaveSchedulerRepositoryPort, 'findActiveAccrualBalances'> = new HcmSchedulerReadRepository(),
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    if (localDay(ctx.now, ctx.timezone) !== numberSetting(setup, 'leaveAccrualDay', 1)) {
      return { itemsProcessed: 0 };
    }
    const balances = await this.repository.findActiveAccrualBalances({ tenantId: ctx.tenantId, now: ctx.now, setup });
    let itemsProcessed = 0;
    for (const balance of balances) {
      const policy = findLeavePolicy(setup, balance.leaveType);
      if (!policy) continue;
      const accrualHours = monthlyAccrualHours(policy, setup);
      if (accrualHours <= 0) continue;
      await ctx.runCommand({
        commandName: 'UpdateAbsenceAccrualBalance',
        aggregateType: 'AbsenceAccrualBalance',
        aggregateId: balance.id,
        subjectWorkerId: balance.workerId,
        payload: {
          balanceId: balance.id,
          balanceHours: round2(balance.balanceHours + accrualHours),
          accruedHours: round2(balance.accruedHours + accrualHours),
        },
        permissions: this.permissions,
        reason: this.name,
      });
      itemsProcessed += 1;
    }
    return { itemsProcessed };
  }
}

@Injectable()
export class LeaveCarryoverRunJob implements ScheduledJob {
  readonly name = 'leave-carryover-run';
  readonly cron = '0 3 31 12 *';
  readonly permissions = ['LEAVE_BALANCE_UPDATE'];
  readonly periodKey = yearPeriodKey;

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<LeaveSchedulerRepositoryPort, 'findCarryoverBalances'> = new HcmSchedulerReadRepository(),
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const balances = await this.repository.findCarryoverBalances({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const balance of balances) {
      await ctx.runCommand({
        commandName: 'CarryOverAbsenceAccrualBalance',
        aggregateType: 'AbsenceAccrualBalance',
        aggregateId: balance.id,
        subjectWorkerId: balance.workerId,
        payload: { balanceId: balance.id },
        permissions: this.permissions,
        reason: this.name,
      });
    }
    return { itemsProcessed: balances.length };
  }
}

@Injectable()
export class LeaveBalanceExpiryAlertJob implements ScheduledJob {
  readonly name = 'leave-balance-expiry-alert';
  readonly cron = '0 9 * * 1';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<LeaveSchedulerRepositoryPort, 'findBalanceAlerts'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const alerts = await this.repository.findBalanceAlerts({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const alert of alerts) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [alert.workerId],
        managerAudienceWorkerIds: optionalUuidArray(alert.managerWorkerId),
        reminderType: 'LEAVE_BALANCE_ALERT',
        subject: { aggregateType: 'AbsenceAccrualBalance', subjectId: alert.balanceId, subjectWorkerId: alert.workerId },
        dueDate: alert.dueDate,
        payload: {
          reason: alert.reason,
          leaveType: alert.leaveType,
          balanceHours: alert.balanceHours,
          title: alert.reason === 'NEGATIVE_BALANCE' ? 'Leave balance needs attention' : 'Leave balance expiry approaching',
        },
        escalationTier: alert.reason === 'NEGATIVE_BALANCE' ? escalationTier(0, true) : escalationTier(-7),
        now: ctx.now,
      });
    }
    return { itemsProcessed: alerts.length };
  }
}

@Injectable()
export class LeaveApprovalSlaJob implements ScheduledJob {
  readonly name = 'leave-approval-sla';
  readonly cron = '0 8 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<LeaveSchedulerRepositoryPort, 'findApprovalSlaBreaches'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const breaches = await this.repository.findApprovalSlaBreaches({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const breach of breaches) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [breach.approverWorkerId],
        managerAudienceWorkerIds: optionalUuidArray(breach.approverManagerWorkerId),
        reminderType: 'LEAVE_APPROVAL_SLA',
        subject: { aggregateType: 'AbsenceRequest', subjectId: breach.requestId, subjectWorkerId: breach.workerId },
        dueDate: breach.dueDate,
        payload: { workerId: breach.workerId.value, submittedAt: breach.submittedAt.toISOString(), daysOverdue: breach.daysOverdue },
        escalationTier: escalationTier(breach.daysOverdue, breach.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: breaches.length };
  }
}

@Injectable()
export class ReturnToWorkReminderJob implements ScheduledJob {
  readonly name = 'return-to-work-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<LeaveSchedulerRepositoryPort, 'findUpcomingReturnToWorkCases'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const cases = await this.repository.findUpcomingReturnToWorkCases({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const leaveCase of cases) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [leaveCase.workerId],
        managerAudienceWorkerIds: optionalUuidArray(leaveCase.managerWorkerId),
        reminderType: 'RETURN_TO_WORK_REMINDER',
        subject: { aggregateType: 'LeaveCase', subjectId: leaveCase.leaveCaseId, subjectWorkerId: leaveCase.workerId },
        dueDate: leaveCase.expectedReturnDate,
        payload: { expectedReturnDate: leaveCase.expectedReturnDate.toISOString() },
        escalationTier: escalationTier(-1),
        now: ctx.now,
      });
    }
    return { itemsProcessed: cases.length };
  }
}

@Injectable()
export class AttendanceDailyFinalizationJob implements ScheduledJob {
  readonly name = 'attendance-daily-finalization';
  readonly cron = '0 20 * * *';
  readonly permissions = ['ATTENDANCE_LEDGER_FINALIZE'];
  readonly periodKey = (now: Date, timezone: string): string => previousLocalDateKey(now, timezone);

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<AttendanceSchedulerRepositoryPort, 'findFinalizationTargets'> = new HcmSchedulerReadRepository(),
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const targetDate = previousLocalDateKey(ctx.now, ctx.timezone);
    const targets = await this.repository.findFinalizationTargets({ tenantId: ctx.tenantId, targetDate, now: ctx.now, setup });
    for (const target of targets) {
      await ctx.runCommand({
        commandName: 'FinalizeAttendanceDailyLedger',
        aggregateType: 'AttendanceDailyLedger',
        payload: { date: targetDate, workplaceCode: target.workplaceCode },
        permissions: this.permissions,
        reason: this.name,
      });
    }
    return { itemsProcessed: targets.length };
  }
}

@Injectable()
export class TimesheetSubmissionReminderJob implements ScheduledJob {
  readonly name = 'timesheet-submission-reminder';
  readonly cron = '0 10 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<AttendanceSchedulerRepositoryPort, 'findUnsubmittedTimesheets'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const rows = await this.repository.findUnsubmittedTimesheets({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'TIMESHEET_SUBMISSION_REMINDER',
        subject: { aggregateType: 'Timesheet', subjectId: row.timesheetId, subjectWorkerId: row.workerId },
        dueDate: row.periodEnd,
        payload: { periodEnd: row.periodEnd.toISOString() },
        escalationTier: escalationTier(-1),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class TimesheetApprovalSlaJob implements ScheduledJob {
  readonly name = 'timesheet-approval-sla';
  readonly cron = '0 8 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<AttendanceSchedulerRepositoryPort, 'findTimesheetApprovalSlaBreaches'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const rows = await this.repository.findTimesheetApprovalSlaBreaches({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.approverWorkerId],
        managerAudienceWorkerIds: optionalUuidArray(row.approverManagerWorkerId),
        reminderType: 'TIMESHEET_APPROVAL_SLA',
        subject: { aggregateType: 'Timesheet', subjectId: row.timesheetId, subjectWorkerId: row.workerId },
        dueDate: row.dueDate,
        payload: { workerId: row.workerId.value, submittedAt: row.submittedAt.toISOString(), daysOverdue: row.daysOverdue },
        escalationTier: escalationTier(row.daysOverdue, row.daysOverdue > 0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class AttendanceAnomalyAlertJob implements ScheduledJob {
  readonly name = 'attendance-anomaly-alert';
  readonly cron = '0 7 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<AttendanceSchedulerRepositoryPort, 'findAttendanceAnomalies'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const targetDate = previousLocalDateKey(ctx.now, ctx.timezone);
    const rows = await this.repository.findAttendanceAnomalies({ tenantId: ctx.tenantId, targetDate, now: ctx.now, setup });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: [row.workerId],
        managerAudienceWorkerIds: optionalUuidArray(row.managerWorkerId),
        reminderType: 'ATTENDANCE_ANOMALY_ALERT',
        subject: { aggregateType: 'AttendanceDailyLedger', subjectId: row.anomalyId, subjectWorkerId: row.workerId },
        dueDate: new Date(`${row.workDate}T00:00:00.000Z`),
        payload: { anomalyType: row.anomalyType, workDate: row.workDate, severity: row.severity },
        escalationTier: row.severity === 'CRITICAL' ? escalationTier(0, true) : escalationTier(0),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class PayrollCycleOpenJob implements ScheduledJob {
  readonly name = 'payroll-cycle-open';
  readonly cron = '0 6 * * *';
  readonly permissions = ['PAYROLL_CYCLE_CREATE'];
  readonly periodKey = monthPeriodKey;

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<PayrollSchedulerRepositoryPort, 'findCyclesToOpen'> = new HcmSchedulerReadRepository(),
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const cycles = await this.repository.findCyclesToOpen({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const cycle of cycles) {
      await ctx.runCommand({
        commandName: 'CreatePayrollCycle',
        aggregateType: 'PayrollCycle',
        payload: {
          cycleName: cycle.cycleName,
          payPeriodStart: cycle.payPeriodStart,
          payPeriodEnd: cycle.payPeriodEnd,
          payDate: cycle.payDate,
        },
        permissions: this.permissions,
        reason: this.name,
      });
    }
    return { itemsProcessed: cycles.length };
  }
}

@Injectable()
export class PayrollCutoffReminderJob implements ScheduledJob {
  readonly name = 'payroll-cutoff-reminder';
  readonly cron = '0 9 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<PayrollSchedulerRepositoryPort, 'findCutoffReminderItems'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const rows = await this.repository.findCutoffReminderItems({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const row of rows) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: row.payrollAdminWorkerIds,
        reminderType: 'PAYROLL_CUTOFF_REMINDER',
        subject: { aggregateType: 'PayrollCycle', subjectId: row.payrollCycleId },
        dueDate: row.cutoffDate,
        payload: { cycleName: row.cycleName, inputsNotFinalized: row.inputsNotFinalized, daysUntilCutoff: row.daysUntilCutoff },
        escalationTier: escalationTier(-Math.max(0, row.daysUntilCutoff)),
        now: ctx.now,
      });
    }
    return { itemsProcessed: rows.length };
  }
}

@Injectable()
export class PayrollReadinessCheckJob implements ScheduledJob {
  readonly name = 'payroll-readiness-check';
  readonly cron = '0 11 * * *';

  constructor(
    @Optional() @Inject(HcmSchedulerReadRepository) private readonly repository: Pick<PayrollSchedulerRepositoryPort, 'findReadinessIssues'> = new HcmSchedulerReadRepository(),
    private readonly reminderEmitter: ReminderEmitter,
    private readonly setupService: HcmSetupService = new HcmSetupService(),
  ) {}

  async runForTenant(ctx: JobContext): Promise<JobOutcome> {
    const setup = await this.setupService.getSetup(ctx.tenantId);
    const issues = await this.repository.findReadinessIssues({ tenantId: ctx.tenantId, now: ctx.now, setup });
    for (const issue of issues) {
      await this.reminderEmitter.emit({
        tenantId: ctx.tenantId,
        audienceWorkerIds: issue.payrollAdminWorkerIds,
        reminderType: 'PAYROLL_READINESS_CHECK',
        subject: { aggregateType: 'PayrollCycle', subjectId: issue.payrollCycleId, subjectWorkerId: issue.workerId },
        dueDate: issue.dueDate,
        payload: { workerId: issue.workerId.value, issueType: issue.issueType },
        escalationTier: escalationTier(0, true),
        now: ctx.now,
      });
    }
    return { itemsProcessed: issues.length };
  }
}

export const HCM_SCHEDULED_JOB_PROVIDERS = [
  LeaveAccrualRunJob,
  LeaveCarryoverRunJob,
  LeaveBalanceExpiryAlertJob,
  LeaveApprovalSlaJob,
  ReturnToWorkReminderJob,
  AttendanceDailyFinalizationJob,
  TimesheetSubmissionReminderJob,
  TimesheetApprovalSlaJob,
  AttendanceAnomalyAlertJob,
  PayrollCycleOpenJob,
  PayrollCutoffReminderJob,
  PayrollReadinessCheckJob,
];

export function monthPeriodKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

export function yearPeriodKey(now: Date): string {
  return now.toISOString().slice(0, 4);
}

function previousLocalDateKey(now: Date, timezone: string): string {
  const parts = localDateParts(now, timezone);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function localDay(now: Date, timezone: string): number {
  return localDateParts(now, timezone).day;
}

function localDateParts(now: Date, timezone: string): { year: number; month: number; day: number } {
  const values = new Map(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
  };
}

function monthlyAccrualHours(policy: LeavePolicy, setup: HcmSetupConfig): number {
  const ledgerHours = policy.accrualRules?.filter((rule) => rule.active !== false)
    .map((rule) => numericOutcome(rule, ['monthlyHours', 'hoursPerMonth', 'amount']))
    .find((value) => value !== undefined);
  if (ledgerHours !== undefined) return ledgerHours;
  const ledgerDays = policy.accrualRules?.filter((rule) => rule.active !== false)
    .map((rule) => numericOutcome(rule, ['monthlyDays', 'daysPerMonth']))
    .find((value) => value !== undefined);
  if (ledgerDays !== undefined) return ledgerDays * standardDayHours(setup);
  const annualEntitlement = policy.annualEntitlement ?? 0;
  return policy.unit === 'HOURS'
    ? annualEntitlement / 12
    : (annualEntitlement * standardDayHours(setup)) / 12;
}

function numericOutcome(rule: PolicyRuleLedger, keys: string[]): number | undefined {
  for (const outcome of rule.outcomes ?? []) {
    const value = outcome.value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (isRecord(value)) {
      for (const key of keys) {
        const candidate = value[key];
        if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
      }
    }
  }
  return undefined;
}

function standardDayHours(setup: HcmSetupConfig): number {
  return (setup.attendancePolicy?.standardDailyMinutes ?? 480) / 60;
}

function findLeavePolicy(setup: HcmSetupConfig, leaveType: string): LeavePolicy | undefined {
  return setup.leavePolicies.find((policy) => policy.active && policy.code === leaveType);
}

function escalationTier(offsetDays: number, escalateToManager = false): ReminderEscalationTier {
  const prefix = offsetDays < 0 ? 'T_MINUS' : offsetDays > 0 ? 'T_PLUS' : 'T';
  const code = offsetDays === 0 ? 'T_ZERO' : `${prefix}_${Math.abs(offsetDays)}`;
  return {
    code,
    label: offsetDays === 0 ? 'Due now' : `${Math.abs(offsetDays)} day${Math.abs(offsetDays) === 1 ? '' : 's'} ${offsetDays < 0 ? 'before due' : 'overdue'}`,
    level: Math.max(0, offsetDays),
    escalateToManager,
  };
}

function optionalUuidArray(value: Uuid | undefined): Uuid[] {
  return value ? [value] : [];
}

function numberSetting(setup: HcmSetupConfig, key: string, fallback: number): number {
  const value = recordValue(setup.policyGovernance, key)
    ?? recordValue(setup.attendancePolicy, key)
    ?? recordValue(setup.payrollCalculationPolicy, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function recordValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectHasKey(value: unknown, key: string): boolean {
  return isRecord(value) && isRecord(value[key]);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date): number {
  return Math.floor((startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) / 86_400_000);
}

function startOfLocalDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dbDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
