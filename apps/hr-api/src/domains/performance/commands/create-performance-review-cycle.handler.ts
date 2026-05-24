import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PerformanceReviewCycle } from '../aggregates/performance-review-cycle.aggregate.js';
import { PerformanceReviewCycleRepository } from '../repositories/performance-review-cycle.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('CreatePerformanceReviewCycle')
@Injectable()
export class CreatePerformanceReviewCycleHandler {
  constructor(
    private readonly repo: PerformanceReviewCycleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      name: string;
      cycleYear: number;
      startDate: Date;
      endDate: Date;
      reviewType: string;
    };
    const ar = PerformanceReviewCycle.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        name: payload.name,
        cycleYear: payload.cycleYear,
        startDate: payload.startDate,
        endDate: payload.endDate,
        reviewType: payload.reviewType,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { performanceReviewCycleId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'PerformanceReviewCycle'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
