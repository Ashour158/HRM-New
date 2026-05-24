import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PayEquityReviewRepository } from '../repositories/pay-equity-review.repository.js';
import { DeiAnalyticsEventsPublisher } from '../events/dei-analytics-events.publisher.js';

export interface ClosePayEquityReviewPayload {
  payEquityReviewId: string;
  completedActions?: Record<string, unknown>;
}

@Injectable()
@CommandHandler('ClosePayEquityReview')
export class ClosePayEquityReviewHandler {
  constructor(
    private readonly repo: PayEquityReviewRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: DeiAnalyticsEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ClosePayEquityReviewPayload;
    const entity = await this.repo.findById(new Uuid(payload.payEquityReviewId));
    if (!entity) throw new Error('PayEquityReview not found');
    entity.close(command.correlationId, payload.completedActions);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { payEquityReviewId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'PayEquityReview'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
