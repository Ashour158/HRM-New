/**
 * Warehouse Export Consumer
 *
 * Subscribes to **all** hr.* topics and pushes every event into the data
 * warehouse event stream for analytics and reporting.
 *
 * Consumer group: reporting-warehouse-export
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { AllHrTopics } from '@hcm/event-schemas';
import { EventBus } from '../../platform/event-bus/event-bus.js';
import { InboxConsumer } from '../../platform/outbox-inbox/inbox-consumer.js';
import { DataWarehouseAdapter } from '../adapters/data-warehouse.adapter.js';

@Injectable()
export class WarehouseExportConsumer implements OnModuleInit {
  private readonly logger = new Logger(WarehouseExportConsumer.name);
  private readonly consumerName = 'reporting-warehouse-export';
  private readonly consumerVersion = '1';

  constructor(
    private readonly eventBus: EventBus,
    private readonly inboxConsumer: InboxConsumer,
    private readonly warehouseAdapter: DataWarehouseAdapter,
  ) {}

  onModuleInit(): void {
    for (const topic of AllHrTopics) {
      this.eventBus.subscribe(topic, this.consumerName, {
        consumerGroup: this.consumerName,
        handle: async (event: HrEventEnvelope<unknown>) => {
          await this.inboxConsumer.consume(event, this.consumerName, this.consumerVersion, {
            handle: async () => this.handle(event),
          });
        },
      });
    }
  }

  private async handle(event: HrEventEnvelope<unknown>): Promise<void> {
    this.logger.log({
      type: 'CONSUMER_WAREHOUSE_EXPORT_EVENT',
      eventName: event.eventName,
      eventId: event.eventId.value,
      tenantId: event.tenantId.value,
    });

    await this.warehouseAdapter.exportEvents(
      event.tenantId,
      event.occurredAt,
      event.occurredAt,
    );
  }
}
