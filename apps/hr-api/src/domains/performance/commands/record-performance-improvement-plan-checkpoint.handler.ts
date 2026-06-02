import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PerformanceImprovementPlanRepository } from '../repositories/performance-improvement-plan.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('RecordPerformanceImprovementPlanCheckpoint')
@Injectable()
export class RecordPerformanceImprovementPlanCheckpointHandler {
  constructor(
    private readonly repo: PerformanceImprovementPlanRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      performanceImprovementPlanId: Uuid;
      milestoneTitle?: string;
      milestoneDay?: number;
      milestoneStatus?: string;
      metricUpdates?: Array<{ metric: string; current: number }>;
      note?: string;
    };
    const ar = await this.repo.findById(payload.performanceImprovementPlanId);
    if (!ar) throw new Error('Performance improvement plan not found');
    ar.recordCheckpoint({
      milestoneTitle: payload.milestoneTitle,
      milestoneDay: payload.milestoneDay,
      milestoneStatus: payload.milestoneStatus,
      metricUpdates: payload.metricUpdates,
      note: payload.note,
    }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { performanceImprovementPlanId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'PerformanceImprovementPlan'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
