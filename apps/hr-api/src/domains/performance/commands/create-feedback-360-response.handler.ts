import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Feedback360Response } from '../aggregates/feedback-360-response.aggregate.js';
import { Feedback360ResponseRepository } from '../repositories/feedback-360-response.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('CreatePerformanceFeedback360Response')
@Injectable()
export class CreateFeedback360ResponseHandler {
  constructor(
    private readonly repo: Feedback360ResponseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      cycleId: string;
      revieweeId: string;
      reviewerId: string;
      relationshipType: string;
      isAnonymous?: boolean;
    };
    const ar = Feedback360Response.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        cycleId: new Uuid(payload.cycleId),
        revieweeId: new Uuid(payload.revieweeId),
        reviewerId: new Uuid(payload.reviewerId),
        relationshipType: payload.relationshipType,
        isAnonymous: payload.isAnonymous,
        visibility: payload.isAnonymous === false ? 'NAMED' : 'ANONYMOUS',
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { feedback360ResponseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'PerformanceFeedback360Response'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
