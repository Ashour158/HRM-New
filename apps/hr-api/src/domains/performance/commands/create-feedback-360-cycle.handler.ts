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
    try {
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
      console.error('[CreateFeedback360CycleHandler] payload:', JSON.stringify(payload));
      console.error('[CreateFeedback360CycleHandler] command.tenantId:', command.tenantId);
      console.error('[CreateFeedback360CycleHandler] command.correlationId:', command.correlationId);
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
      console.error('[CreateFeedback360CycleHandler] aggregate created, id=', ar.id.value);
      try {
        await this.repo.save(ar);
        console.error('[CreateFeedback360CycleHandler] repo.save OK');
      } catch (e) {
        console.error('SAVE ERROR:', e);
        throw e;
      }
      try {
        await this.publisher.publishFromAggregate(ar);
        console.error('[CreateFeedback360CycleHandler] publish OK');
      } catch (e) {
        console.error('PUBLISH ERROR:', e);
        throw e;
      }
      try {
        const actions = this.fsm.getAllowedActionsFromState(ar.status, 'PerformanceFeedback360Cycle');
        console.error('FSM ACTIONS:', actions);
      } catch (e) {
        console.error('FSM ERROR:', e);
        throw e;
      }
      const result = {
        success: true as const,
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
      };
      console.error('[CreateFeedback360CycleHandler] result:', JSON.stringify({
        success: result.success,
        aggregateId: typeof result.aggregateId,
        aggregateIdValue: result.aggregateId?.value,
        newState: result.newState,
      }));
      return result as CommandResult<unknown>;
    } catch (e) {
      console.error('[CreateFeedback360CycleHandler] UNCAUGHT ERROR:', e);
      throw e;
    }
  }
}
