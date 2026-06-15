import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { toUuid } from '../../common/uuid-normalizer.js';
import { Grievance } from '../aggregates/grievance.aggregate.js';
import { GrievanceRepository } from '../repositories/grievance.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('CreateGrievance')
@Injectable()
export class CreateGrievanceHandler {
  constructor(
    private readonly repo: GrievanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workerId: Uuid | string; grievanceType: string; description: string; resolution?: string; arbitratorDecision?: string };
    const ar = Grievance.create({
      id: Uuid.generate(),
      tenantId: command.tenantId,
      workerId: toUuid(payload.workerId),
      grievanceType: payload.grievanceType,
      description: payload.description,
      resolution: payload.resolution,
      arbitratorDecision: payload.arbitratorDecision,
    }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { grievanceId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Grievance'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
