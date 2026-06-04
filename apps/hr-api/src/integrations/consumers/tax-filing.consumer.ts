/**
 * Tax Filing Consumer
 *
 * Subscribes to hr.payroll.v1 and triggers tax authority filing generation on
 * PayrollCycleClosed.
 *
 * Consumer group: tax-filing-saga
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { isPayrollCycleClosedEvent } from '@hcm/event-schemas';
import { EventBus } from '../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../platform/outbox-inbox/inbox-consumer.js';
import { TaxAuthorityAdapter } from '../adapters/tax-authority.adapter.js';

@Injectable()
export class TaxFilingConsumer implements OnModuleInit {
  private readonly logger = new Logger(TaxFilingConsumer.name);
  private readonly consumerName = 'tax-filing-saga';
  private readonly consumerVersion = '1';

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly taxAdapter: TaxAuthorityAdapter,
  ) {}

  onModuleInit(): void {
    this.inboxConsumer.registerReplayHandler(this.consumerName, this.consumerVersion, {
      handle: async (event) => this.handle(event),
    });
    this.eventBus.subscribe('hr.payroll.v1', this.consumerName, {
      consumerGroup: this.consumerName,
      handle: async (event: HrEventEnvelope<unknown>) => {
        await this.inboxConsumer.consume(event, this.consumerName, this.consumerVersion, {
          handle: async () => this.handle(event),
        });
      },
    });
  }

  private async handle(event: HrEventEnvelope<unknown>): Promise<void> {
    if (isPayrollCycleClosedEvent(event)) {
      this.logger.log({
        type: 'CONSUMER_PAYROLL_CYCLE_CLOSED',
        cycleId: event.payload.payrollCycleId.value,
      });

      // In production, resolve jurisdiction from the legal entity read model
      await this.taxAdapter.generateTaxFiling(event.payload.payrollCycleId, 'US-FED');
      return;
    }

    if (event.eventName === 'TaxJurisdictionAssignmentFinalized') {
      const payload = event.payload as { workerId: { value: string }; jurisdiction: string };
      this.logger.log({
        type: 'CONSUMER_TAX_JURISDICTION_FINALIZED',
        workerId: payload.workerId.value,
        jurisdiction: payload.jurisdiction,
      });

      await this.taxAdapter.validateTaxData(payload.workerId as unknown as import('@hcm/shared-kernel').Uuid);
      return;
    }

    this.logger.debug({ type: 'CONSUMER_EVENT_IGNORED', eventName: event.eventName });
  }
}
