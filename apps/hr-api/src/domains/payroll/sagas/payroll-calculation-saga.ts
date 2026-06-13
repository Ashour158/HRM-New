import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { HR_PAYROLL, isPayrollCycleOpenedEvent } from '@hcm/event-schemas';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { EventBus } from '../../../platform/event-bus/event-bus.js';
import { resolveTenantCurrency } from '../../hcm-setup/hcm-setup-currency.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { PayrollCycleRepository } from '../repositories/payroll-cycle.repository.js';
import { PayrollCalculationRunRepository } from '../repositories/payroll-calculation-run.repository.js';

import { PayrollCalculationRun } from '../aggregates/payroll-calculation-run.aggregate.js';

import { PayrollEventsPublisher } from '../events/payroll-events.publisher.js';

@Injectable()
export class PayrollCalculationSaga implements OnModuleInit {
  private readonly logger = new Logger(PayrollCalculationSaga.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly payrollCycleRepo: PayrollCycleRepository,
    private readonly calculationRunRepo: PayrollCalculationRunRepository,
    private readonly eventsPublisher: PayrollEventsPublisher,
    private readonly hcmSetupService: HcmSetupService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(HR_PAYROLL, 'payroll-calculation-saga', {
      consumerGroup: 'payroll-calculation-saga',
      handle: async (event: HrEventEnvelope<unknown>) => {
        if (isPayrollCycleOpenedEvent(event)) {
          await this.onPayrollCycleOpened(event);
        }
      },
    });
  }

  private async onPayrollCycleOpened(event: HrEventEnvelope<{ payrollCycleId: Uuid; legalEntityId: Uuid; periodStartDate: string; periodEndDate: string; openedBy: Uuid }>): Promise<void> {
    const cycle = await this.payrollCycleRepo.findById(event.payload.payrollCycleId);
    if (!cycle) {
      this.logger.warn(`Payroll cycle ${event.payload.payrollCycleId.value} not found for saga`);
      return;
    }

    const correlationId = new Uuid(event.metadata.correlationId.value);

    this.logger.log({ type: 'SAGA_STEP', step: 1, message: 'Collect payroll inputs', payrollCycleId: cycle.id.value });
    cycle.startInputCollection(correlationId);
    await this.payrollCycleRepo.save(cycle);
    await this.eventsPublisher.publishFromAggregate(cycle);

    this.logger.log({ type: 'SAGA_STEP', step: 2, message: 'Collect time & attendance data', payrollCycleId: cycle.id.value });
    this.logger.log({ type: 'SAGA_STEP', step: 3, message: 'Collect absence/leave data', payrollCycleId: cycle.id.value });
    this.logger.log({ type: 'SAGA_STEP', step: 4, message: 'Collect benefits deductions', payrollCycleId: cycle.id.value });
    this.logger.log({ type: 'SAGA_STEP', step: 5, message: 'Collect compensation changes', payrollCycleId: cycle.id.value });

    this.logger.log({ type: 'SAGA_STEP', step: 6, message: 'Run Payroll Calculation Engine', payrollCycleId: cycle.id.value });
    cycle.startValidation(correlationId);
    await this.payrollCycleRepo.save(cycle);
    await this.eventsPublisher.publishFromAggregate(cycle);

    cycle.startCalculation(correlationId);
    await this.payrollCycleRepo.save(cycle);
    await this.eventsPublisher.publishFromAggregate(cycle);

    const setup = await this.hcmSetupService.getSetup(cycle.tenantId);
    const run = PayrollCalculationRun.start(
      { id: Uuid.generate(), tenantId: cycle.tenantId, payrollCycleId: cycle.id, currency: resolveTenantCurrency(setup) },
      correlationId,
    );
    await this.calculationRunRepo.save(run);
    await this.eventsPublisher.publishFromAggregate(run);

    run.validate(correlationId);
    await this.calculationRunRepo.save(run);
    await this.eventsPublisher.publishFromAggregate(run);

    run.finalize(correlationId);
    await this.calculationRunRepo.save(run);
    await this.eventsPublisher.publishFromAggregate(run);

    this.logger.log({ type: 'SAGA_STEP', step: 7, message: 'Validate results', payrollCycleId: cycle.id.value });
    this.logger.log({ type: 'SAGA_STEP', step: 8, message: 'Generate payslips', payrollCycleId: cycle.id.value });

    this.logger.log({ type: 'SAGA_STEP', step: 9, message: 'Stage for export', payrollCycleId: cycle.id.value });
    cycle.startReview(correlationId);
    await this.payrollCycleRepo.save(cycle);
    await this.eventsPublisher.publishFromAggregate(cycle);

    this.logger.log({ type: 'SAGA_COMPLETED', payrollCycleId: cycle.id.value, status: cycle.status });
  }
}
