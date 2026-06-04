/**
 * Payroll Export Consumer
 *
 * Subscribes to hr.payroll.v1 and triggers payroll data export on
 * PayrollCycleApproved.
 *
 * Consumer group: payroll-export-saga
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { isPayrollCycleApprovedEvent } from '@hcm/event-schemas';
import { EventBus } from '../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../platform/outbox-inbox/inbox-consumer.js';
import { PayrollExportAdapter } from '../adapters/payroll-export.adapter.js';

@Injectable()
export class PayrollExportConsumer implements OnModuleInit {
  private readonly logger = new Logger(PayrollExportConsumer.name);
  private readonly consumerName = 'payroll-export-saga';
  private readonly consumerVersion = '1';

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly payrollAdapter: PayrollExportAdapter,
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
    if (isPayrollCycleApprovedEvent(event)) {
      this.logger.log({
        type: 'CONSUMER_PAYROLL_CYCLE_APPROVED',
        cycleId: event.payload.payrollCycleId.value,
      });

      await this.payrollAdapter.exportPayrollCycle(event.payload.payrollCycleId, 'API');
      return;
    }

    this.logger.debug({ type: 'CONSUMER_EVENT_IGNORED', eventName: event.eventName });
  }
}
