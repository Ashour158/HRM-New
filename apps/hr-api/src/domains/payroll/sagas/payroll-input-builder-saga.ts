import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import {
  HR_ABSENCE,
  HR_BENEFITS,
  HR_COMPENSATION,
  HR_TIME,
  isAbsenceRequestApprovedEvent,
  isBenefitsEnrollmentFinalizedEvent,
  isOvertimeApprovedEvent,
  isTimesheetApprovedEvent,
} from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { resolveTenantCurrency } from '../../hcm-setup/hcm-setup-currency.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { PayrollInputRepository } from '../repositories/payroll-input.repository.js';
import { PayrollInput } from '../aggregates/payroll-input.aggregate.js';
import { PayrollEventsPublisher } from '../events/payroll-events.publisher.js';
import { PayrollCycleRepository } from '../repositories/payroll-cycle.repository.js';
import type { PayrollCycle } from '../aggregates/payroll-cycle.aggregate.js';

@Injectable()
export class PayrollInputBuilderSaga implements OnModuleInit {
  private readonly logger = new Logger(PayrollInputBuilderSaga.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly payrollInputRepo: PayrollInputRepository,
    private readonly eventsPublisher: PayrollEventsPublisher,
    private readonly payrollCycleRepo: PayrollCycleRepository,
    private readonly hcmSetupService: HcmSetupService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(HR_TIME, 'payroll-input-builder-saga', {
      consumerGroup: 'payroll-input-builder-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isTimesheetApprovedEvent(event)) await this.createInputFromTimesheet(event);
        if (isOvertimeApprovedEvent(event)) await this.createInputFromOvertime(event);
      },
    });

    this.eventBus.subscribe(HR_ABSENCE, 'payroll-input-builder-saga', {
      consumerGroup: 'payroll-input-builder-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isAbsenceRequestApprovedEvent(event)) await this.createInputFromAbsence(event);
      },
    });

    this.eventBus.subscribe(HR_BENEFITS, 'payroll-input-builder-saga', {
      consumerGroup: 'payroll-input-builder-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isBenefitsEnrollmentFinalizedEvent(event) || event.eventName === 'BenefitsEnrollmentEffective') {
          await this.createInputFromBenefits(event);
        }
      },
    });

    this.eventBus.subscribe(HR_COMPENSATION, 'payroll-input-builder-saga', {
      consumerGroup: 'payroll-input-builder-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (event.eventName.startsWith('Compensation')) await this.createInputFromCompensation(event);
      },
    });
  }

  private async createInputFromTimesheet(event: HrEventEnvelope<{ timesheetId: Uuid | string; workerId: Uuid | string; approvedBy: Uuid | string }>): Promise<void> {
    await this.createInputFromEvent(event, {
      source: 'TimesheetApproved',
      workerId: this.toUuid(event.payload.workerId),
      inputType: 'TIMESHEET_HOURS',
      amount: this.readNumber(event.payload, 'amount') ?? 0,
      currency: await this.resolveEventCurrency(event, event.payload),
      description: `Timesheet ${this.uuidValue(event.payload.timesheetId)}`,
    });
  }

  private async createInputFromOvertime(event: HrEventEnvelope<{ overtimeRequestId: Uuid | string; workerId: Uuid | string; approvedBy: Uuid | string }>): Promise<void> {
    await this.createInputFromEvent(event, {
      source: 'OvertimeApproved',
      workerId: this.toUuid(event.payload.workerId),
      inputType: 'OVERTIME_PAY',
      amount: this.readNumber(event.payload, 'amount') ?? 0,
      currency: await this.resolveEventCurrency(event, event.payload),
      description: `Overtime ${this.uuidValue(event.payload.overtimeRequestId)}`,
    });
  }

  private async createInputFromAbsence(event: HrEventEnvelope<{
    absenceRequestId: Uuid | string;
    workerId: Uuid | string;
    approvedBy: Uuid | string;
    durationAmount?: number;
    durationUnit?: string;
    payrollImpact?: string;
  }>): Promise<void> {
    const payrollImpact = this.readString(event.payload, 'payrollImpact') ?? 'PAID_LEAVE';
    await this.createInputFromEvent(event, {
      source: 'AbsenceRequestApproved',
      workerId: this.toUuid(event.payload.workerId),
      inputType: payrollImpact === 'UNPAID_LEAVE' ? 'UNPAID_LEAVE' : 'APPROVED_LEAVE',
      amount: this.readNumber(event.payload, 'amount') ?? 0,
      currency: await this.resolveEventCurrency(event, event.payload),
      description: `Leave ${this.uuidValue(event.payload.absenceRequestId)} ${event.payload.durationAmount ?? ''} ${event.payload.durationUnit ?? ''}`.trim(),
    });
  }

  private async createInputFromBenefits(event: HrEventEnvelope<unknown>): Promise<void> {
    const payload = event.payload as {
      enrollmentId?: Uuid | string;
      workerId?: Uuid | string;
      finalizedBy?: Uuid | string;
    };
    await this.createInputFromEvent(event, {
      source: event.eventName,
      workerId: this.toUuid(payload.workerId),
      inputType: 'BENEFITS_DEDUCTION',
      amount: this.readNumber(payload, 'amount') ?? 0,
      currency: await this.resolveEventCurrency(event, payload),
      description: `Benefits ${this.uuidValue(payload.enrollmentId)}`,
    });
  }

  private async createInputFromCompensation(event: HrEventEnvelope<unknown>): Promise<void> {
    const payload = event.payload as { workerId?: Uuid | string; changeId?: Uuid | string; amount?: number; currency?: string };
    await this.createInputFromEvent(event, {
      source: event.eventName,
      workerId: this.toUuid(payload.workerId),
      inputType: 'COMPENSATION_CHANGE',
      amount: this.readNumber(payload, 'amount') ?? 0,
      currency: await this.resolveEventCurrency(event, payload),
      description: `Compensation ${event.eventName} ${this.uuidValue(payload.changeId)}`.trim(),
    });
  }

  private async createInputFromEvent(
    event: HrEventEnvelope<unknown>,
    input: {
      source: string;
      workerId?: Uuid;
      inputType: string;
      amount: number;
      currency: string;
      description: string;
    },
  ): Promise<void> {
    if (!input.workerId) {
      this.logger.warn({ type: 'SAGA_PAYROLL_INPUT_SKIPPED', source: input.source, reason: 'MISSING_WORKER_ID' });
      return;
    }
    const payrollCycle = await this.resolveActivePayrollCycle(event.tenantId, event.occurredAt);
    if (!payrollCycle) {
      this.logger.warn({ type: 'SAGA_PAYROLL_INPUT_SKIPPED', source: input.source, reason: 'NO_ACTIVE_PAYROLL_CYCLE' });
      return;
    }

    const payrollInput = PayrollInput.create(
      {
        id: Uuid.generate(),
        tenantId: event.tenantId,
        workerId: input.workerId,
        payrollCycleId: payrollCycle.id,
        inputType: input.inputType,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
      },
      event.metadata.correlationId,
    );
    await this.payrollInputRepo.save(payrollInput);
    await this.eventsPublisher.publishFromAggregate(payrollInput);
    this.logger.log({
      type: 'SAGA_AUTO_CREATED_PAYROLL_INPUT',
      source: input.source,
      inputId: payrollInput.id.value,
      payrollCycleId: payrollCycle.id.value,
    });
  }

  private async resolveActivePayrollCycle(tenantId: Uuid, occurredAt: Date): Promise<PayrollCycle | undefined> {
    const eventDate = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
    const cycles = await this.payrollCycleRepo.findByTenant(tenantId);
    return cycles.find((cycle) => (
      cycle.payPeriodStart.getTime() <= eventDate.getTime()
      && cycle.payPeriodEnd.getTime() >= eventDate.getTime()
      && !['CLOSED', 'EXPORTED', 'CANCELLED'].includes(cycle.status)
    ));
  }

  private readNumber(payload: unknown, key: string): number | undefined {
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private readString(payload: unknown, key: string): string | undefined {
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private async resolveEventCurrency(event: HrEventEnvelope<unknown>, payload: unknown): Promise<string> {
    return this.readString(payload, 'currency') ?? resolveTenantCurrency(await this.hcmSetupService.getSetup(event.tenantId));
  }

  private toUuid(value: Uuid | string | undefined): Uuid | undefined {
    if (!value) return undefined;
    return value instanceof Uuid ? value : new Uuid(value);
  }

  private uuidValue(value: Uuid | string | undefined): string {
    if (!value) return '';
    return value instanceof Uuid ? value.value : value;
  }
}
