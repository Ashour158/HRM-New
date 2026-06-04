import { Injectable } from '@nestjs/common';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import type { DomainEvent, Uuid } from '@hcm/shared-kernel';

type BenefitsEventAggregate = {
  id: Uuid;
  tenantId: Uuid;
  status: string;
  workerId?: Uuid;
  programId?: Uuid;
  domainEvents: DomainEvent[];
};

/**
 * Compatibility shim for benefits handlers.
 *
 * Benefits command handlers expose domain event names through
 * CommandResult.eventsEmitted. The CommandBus writes those events to the
 * transactional outbox after audit succeeds, so publishing here would bypass
 * outbox/inbox delivery and duplicate cross-domain publication.
 */
@Injectable()
export class BenefitsEventsPublisher {
  async publishAll(
    _aggregate: BenefitsEventAggregate,
    _command: HrCommandEnvelope<unknown>,
  ): Promise<void> {
    return Promise.resolve();
  }
}
