import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import {
  isTimesheetApprovedEvent, isOvertimeApprovedEvent,
  isAbsenceRequestApprovedEvent, isBenefitsEnrollmentFinalizedEvent,
} from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { PayrollInputRepository } from '../repositories/payroll-input.repository.js';
import { PayrollInput } from '../aggregates/payroll-input.aggregate.js';
import { PayrollEventsPublisher } from '../events/payroll-events.publisher.js';

@Injectable()
export class PayrollInputBuilderSaga implements OnModuleInit {
  private readonly logger = new Logger(PayrollInputBuilderSaga.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly payrollInputRepo: PayrollInputRepository,
    private readonly eventsPublisher: PayrollEventsPublisher,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('hrm.timesheet.events', 'payroll-input-builder-saga', {
      consumerGroup: 'payroll-input-builder-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isTimesheetApprovedEvent(event)) await this.createInputFromTimesheet(event);
        if (isOvertimeApprovedEvent(event)) await this.createInputFromOvertime(event);
      },
    });

    this.eventBus.subscribe('hrm.absence.events', 'payroll-input-builder-saga', {
      consumerGroup: 'payroll-input-builder-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isAbsenceRequestApprovedEvent(event)) await this.createInputFromAbsence(event);
      },
    });

    this.eventBus.subscribe('hrm.benefits.events', 'payroll-input-builder-saga', {
      consumerGroup: 'payroll-input-builder-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isBenefitsEnrollmentFinalizedEvent(event)) await this.createInputFromBenefits(event);
      },
    });

    this.eventBus.subscribe('hrm.compensation.events', 'payroll-input-builder-saga', {
      consumerGroup: 'payroll-input-builder-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (event.eventName.startsWith('Compensation')) await this.createInputFromCompensation(event);
      },
    });
  }

  private async createInputFromTimesheet(event: HrEventEnvelope<{ timesheetId: Uuid; workerId: Uuid; approvedBy: Uuid }>): Promise<void> {
    const input = PayrollInput.create(
      {
        id: Uuid.generate(),
        tenantId: event.tenantId,
        workerId: event.payload.workerId,
        payrollCycleId: Uuid.generate(), // placeholder; in production resolve active cycle
        inputType: 'TIMESHEET_HOURS',
        amount: 0,
        currency: 'USD',
        description: `Timesheet ${event.payload.timesheetId.value}`,
      },
      event.metadata.correlationId,
    );
    await this.payrollInputRepo.save(input);
    await this.eventsPublisher.publishFromAggregate(input);
    this.logger.log({ type: 'SAGA_AUTO_CREATED_PAYROLL_INPUT', source: 'TimesheetApproved', inputId: input.id.value });
  }

  private async createInputFromOvertime(event: HrEventEnvelope<{ overtimeRequestId: Uuid; workerId: Uuid; approvedBy: Uuid }>): Promise<void> {
    const input = PayrollInput.create(
      {
        id: Uuid.generate(),
        tenantId: event.tenantId,
        workerId: event.payload.workerId,
        payrollCycleId: Uuid.generate(),
        inputType: 'OVERTIME_PAY',
        amount: 0,
        currency: 'USD',
        description: `Overtime ${event.payload.overtimeRequestId.value}`,
      },
      event.metadata.correlationId,
    );
    await this.payrollInputRepo.save(input);
    await this.eventsPublisher.publishFromAggregate(input);
    this.logger.log({ type: 'SAGA_AUTO_CREATED_PAYROLL_INPUT', source: 'OvertimeApproved', inputId: input.id.value });
  }

  private async createInputFromAbsence(event: HrEventEnvelope<{ absenceRequestId: Uuid; workerId: Uuid; approvedBy: Uuid }>): Promise<void> {
    const input = PayrollInput.create(
      {
        id: Uuid.generate(),
        tenantId: event.tenantId,
        workerId: event.payload.workerId,
        payrollCycleId: Uuid.generate(),
        inputType: 'ABSENCE_DEDUCTION',
        amount: 0,
        currency: 'USD',
        description: `Absence ${event.payload.absenceRequestId.value}`,
      },
      event.metadata.correlationId,
    );
    await this.payrollInputRepo.save(input);
    await this.eventsPublisher.publishFromAggregate(input);
    this.logger.log({ type: 'SAGA_AUTO_CREATED_PAYROLL_INPUT', source: 'AbsenceRequestApproved', inputId: input.id.value });
  }

  private async createInputFromBenefits(event: HrEventEnvelope<{ enrollmentId: Uuid; workerId: Uuid; finalizedBy: Uuid }>): Promise<void> {
    const input = PayrollInput.create(
      {
        id: Uuid.generate(),
        tenantId: event.tenantId,
        workerId: event.payload.workerId,
        payrollCycleId: Uuid.generate(),
        inputType: 'BENEFITS_DEDUCTION',
        amount: 0,
        currency: 'USD',
        description: `Benefits ${event.payload.enrollmentId.value}`,
      },
      event.metadata.correlationId,
    );
    await this.payrollInputRepo.save(input);
    await this.eventsPublisher.publishFromAggregate(input);
    this.logger.log({ type: 'SAGA_AUTO_CREATED_PAYROLL_INPUT', source: 'BenefitsEnrollmentFinalized', inputId: input.id.value });
  }

  private async createInputFromCompensation(event: HrEventEnvelope<unknown>): Promise<void> {
    const payload = event.payload as { workerId?: Uuid; changeId?: Uuid };
    const input = PayrollInput.create(
      {
        id: Uuid.generate(),
        tenantId: event.tenantId,
        workerId: payload.workerId ?? Uuid.generate(),
        payrollCycleId: Uuid.generate(),
        inputType: 'COMPENSATION_CHANGE',
        amount: 0,
        currency: 'USD',
        description: `Compensation ${event.eventName}`,
      },
      event.metadata.correlationId,
    );
    await this.payrollInputRepo.save(input);
    await this.eventsPublisher.publishFromAggregate(input);
    this.logger.log({ type: 'SAGA_AUTO_CREATED_PAYROLL_INPUT', source: event.eventName, inputId: input.id.value });
  }
}
