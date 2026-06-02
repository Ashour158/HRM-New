import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Feedback360Cycle } from '../aggregates/feedback-360-cycle.aggregate.js';
import { Feedback360CycleRepository } from '../repositories/feedback-360-cycle.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('CreatePerformanceFeedback360Cycle')
@Injectable()
export class CreateFeedback360CycleHandler {
  constructor(
    private readonly repo: Feedback360CycleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      name: string;
      cycleYear: number;
      reviewCycleId?: string;
      startDate: Date;
      endDate: Date;
      selfReviewDeadline?: Date;
      peerReviewDeadline?: Date;
      managerReviewDeadline?: Date;
      anonymityEnabled?: boolean;
      minPeerReviews?: number;
      maxPeerReviews?: number;
    };
    const ar = Feedback360Cycle.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        name: payload.name,
        cycleYear: payload.cycleYear,
        reviewCycleId: payload.reviewCycleId ? new Uuid(payload.reviewCycleId) : undefined,
        startDate: payload.startDate,
        endDate: payload.endDate,
        selfReviewDeadline: payload.selfReviewDeadline,
        peerReviewDeadline: payload.peerReviewDeadline,
        managerReviewDeadline: payload.managerReviewDeadline,
        anonymityEnabled: payload.anonymityEnabled,
        minPeerReviews: payload.minPeerReviews,
        maxPeerReviews: payload.maxPeerReviews,
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
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'PerformanceFeedback360Cycle'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
      fieldAccessDecisions: {},
    } as CommandResult<unknown>;
  }
}
