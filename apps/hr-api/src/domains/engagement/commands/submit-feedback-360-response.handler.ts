import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Feedback360CycleRepository } from '../repositories/feedback-360-cycle.repository.js';
import { EngagementEventsPublisher } from '../events/engagement-events.publisher.js';

@CommandHandler('SubmitFeedback360Response')
@Injectable()
export class SubmitFeedback360ResponseHandler {
  constructor(
    private readonly repo: Feedback360CycleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: EngagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      feedback360CycleId: Uuid;
      reviewerWorkerId: string;
      relationship?: string;
      competencyScores?: Record<string, number>;
      comments?: string;
    };
    const ar = await this.repo.findById(payload.feedback360CycleId);
    if (!ar) throw new Error('Feedback 360 cycle not found');
    ar.submitResponse(payload, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: {
        feedback360CycleId: ar.id.value,
        reviewerWorkerId: payload.reviewerWorkerId,
        status: ar.status,
        submittedResponses: ar.responses.length,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Feedback360Cycle'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
