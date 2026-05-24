import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PerformanceImprovementPlan } from '../aggregates/performance-improvement-plan.aggregate.js';
import { PerformanceImprovementPlanRepository } from '../repositories/performance-improvement-plan.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('CreatePerformanceImprovementPlan')
@Injectable()
export class CreatePerformanceImprovementPlanHandler {
  constructor(
    private readonly repo: PerformanceImprovementPlanRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      managerId: Uuid;
      objectives?: string[];
      startDate?: Date;
      reviewDate?: Date;
      endDate?: Date;
    };
    const ar = PerformanceImprovementPlan.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        managerId: payload.managerId,
        objectives: payload.objectives,
        startDate: payload.startDate,
        reviewDate: payload.reviewDate,
        endDate: payload.endDate,
      },
      command.correlationId,
    );
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
