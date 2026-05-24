import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PerformanceReviewCycleRepository } from '../repositories/performance-review-cycle.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('ActivatePerformanceReviewCycle')
@Injectable()
export class ActivatePerformanceReviewCycleHandler {
  constructor(
    private readonly repo: PerformanceReviewCycleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { performanceReviewCycleId: Uuid };
    const ar = await this.repo.findById(payload.performanceReviewCycleId);
    if (!ar) throw new Error('Performance review cycle not found');
    ar.activate(command.correlationId);
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
