import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { DevelopmentPlan } from '../aggregates/development-plan.aggregate.js';
import { DevelopmentPlanRepository } from '../repositories/development-plan.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('CreateDevelopmentPlan')
@Injectable()
export class CreateDevelopmentPlanHandler {
  constructor(
    private readonly repo: DevelopmentPlanRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: string;
      managerId: string;
      title?: string;
      description?: string;
      objectives: Array<{ title: string; description?: string; targetDate?: Date; status: string }>;
      skillsToDevelop: string[];
      resources: string[];
      startDate?: Date;
      reviewDate?: Date;
      endDate?: Date;
    };
    const ar = DevelopmentPlan.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: new Uuid(payload.workerId),
        managerId: new Uuid(payload.managerId),
        title: payload.title ?? 'Development plan',
        description: payload.description,
        objectives: {
          objectives: payload.objectives,
          skillsToDevelop: payload.skillsToDevelop,
          resources: payload.resources,
          reviewDate: payload.reviewDate,
        },
        startDate: payload.startDate,
        targetCompletionDate: payload.endDate ?? payload.reviewDate,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { developmentPlanId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'DevelopmentPlan'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
