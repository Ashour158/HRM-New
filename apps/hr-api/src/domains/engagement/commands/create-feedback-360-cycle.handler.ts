import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Feedback360Cycle } from '../aggregates/feedback-360-cycle.aggregate.js';
import { Feedback360CycleRepository } from '../repositories/feedback-360-cycle.repository.js';
import { EngagementEventsPublisher } from '../events/engagement-events.publisher.js';

@CommandHandler('CreateFeedback360Cycle')
@Injectable()
export class CreateFeedback360CycleHandler {
  constructor(
    private readonly repo: Feedback360CycleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: EngagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      subjectWorkerId: Uuid | string;
      reviewers?: string[];
      competencies?: string[];
      startDate?: Date;
      endDate?: Date;
    };
    const subjectWorkerId = payload.subjectWorkerId instanceof Uuid
      ? payload.subjectWorkerId
      : new Uuid(payload.subjectWorkerId);
    const ar = Feedback360Cycle.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        subjectWorkerId,
        reviewers: payload.reviewers,
        competencies: payload.competencies,
        startDate: payload.startDate,
        endDate: payload.endDate,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { feedback360CycleId: ar.id.value, status: ar.status },
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
