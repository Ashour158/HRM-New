import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Objective } from '../aggregates/objective.aggregate.js';
import { ObjectiveRepository } from '../repositories/objective.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('CreateObjective')
@Injectable()
export class CreateObjectiveHandler {
  constructor(
    private readonly repo: ObjectiveRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      ownerId: string;
      orgUnitId?: string;
      parentObjectiveId?: string;
      reviewCycleId?: string;
      title: string;
      description?: string;
      period: string;
      alignmentType?: string;
    };
    const ar = Objective.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        ownerId: new Uuid(payload.ownerId),
        orgUnitId: payload.orgUnitId ? new Uuid(payload.orgUnitId) : undefined,
        parentObjectiveId: payload.parentObjectiveId ? new Uuid(payload.parentObjectiveId) : undefined,
        reviewCycleId: payload.reviewCycleId ? new Uuid(payload.reviewCycleId) : undefined,
        title: payload.title,
        description: payload.description,
        period: payload.period,
        alignmentType: payload.alignmentType,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { objectiveId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Objective'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
