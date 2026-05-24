import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { GrievanceRepository } from '../repositories/grievance.repository.js';
import { UnionLaborEventsPublisher } from '../events/union-labor-events.publisher.js';

@CommandHandler('ArbitrateGrievance')
@Injectable()
export class ArbitrateGrievanceHandler {
  constructor(
    private readonly repo: GrievanceRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: UnionLaborEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { grievanceId: Uuid };
    const ar = await this.repo.findById(payload.grievanceId);
    if (!ar) throw new Error('Grievance not found');
    ar.arbitrate(command.correlationId);
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
