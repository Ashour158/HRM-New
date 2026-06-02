import { Injectable } from '@nestjs/common';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';

/**
 * Compatibility shim for older Core HR handlers.
 *
 * Worker domain events are now emitted through CommandResult.eventsEmitted and
 * written by CommandBus to the transactional outbox after audit succeeds. This
 * class intentionally does not publish directly to EventBus, because doing so
 * would bypass the outbox and can duplicate cross-domain delivery.
 */
@Injectable()
export class WorkerEventsPublisher {
  async publishFromAggregate(_aggregate: {
    id: Uuid;
    tenantId: Uuid;
    status: string;
    domainEvents: DomainEvent[];
  }): Promise<void> {
    return Promise.resolve();
  }
}
