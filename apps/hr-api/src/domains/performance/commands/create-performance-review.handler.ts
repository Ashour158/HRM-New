import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PerformanceReview } from '../aggregates/performance-review.aggregate.js';
import { PerformanceReviewRepository } from '../repositories/performance-review.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';
import { toUuid, type UuidInput } from '../../common/uuid-normalizer.js';

@CommandHandler('CreatePerformanceReview')
@Injectable()
export class CreatePerformanceReviewHandler {
  constructor(
    private readonly repo: PerformanceReviewRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: UuidInput;
      reviewCycleId: UuidInput;
      managerId: UuidInput;
    };
    const ar = PerformanceReview.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: toUuid(payload.workerId),
        reviewCycleId: toUuid(payload.reviewCycleId),
        managerId: toUuid(payload.managerId),
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { performanceReviewId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'PerformanceReview'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
