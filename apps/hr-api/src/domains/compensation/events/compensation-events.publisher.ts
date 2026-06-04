import { Injectable } from '@nestjs/common';

/**
 * Compatibility shim for legacy domain handlers.
 *
 * Command handlers expose domain event names through CommandResult.eventsEmitted.
 * The CommandBus writes those events to the transactional outbox after audit
 * succeeds, so publishing here would bypass or duplicate outbox delivery.
 */
@Injectable()
export class CompensationEventsPublisher {
  async publishAll(_aggregate: unknown, _command?: unknown): Promise<void> {
    return Promise.resolve();
  }
}