import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { NotFoundError, Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { EmploymentRelationshipRepository } from '../repositories/employment-relationship.repository.js';

function toUuid(value: Uuid | string): Uuid {
  return value instanceof Uuid ? value : new Uuid(value);
}

interface StartProbationEmploymentRelationshipPayload {
  relationshipId: Uuid | string;
  probationEndDate: Date | string;
}

@CommandHandler('StartProbationEmploymentRelationship')
@Injectable()
export class StartProbationEmploymentRelationshipHandler {
  constructor(
    private readonly employmentRelationshipRepo: EmploymentRelationshipRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as StartProbationEmploymentRelationshipPayload;
    const relationship = await this.employmentRelationshipRepo.findById(toUuid(payload.relationshipId));
    if (!relationship) throw new NotFoundError('Employment relationship not found');

    relationship.startProbation(new Date(payload.probationEndDate), command.correlationId);
    const eventsEmitted = relationship.domainEvents.map((event) => event.eventName);
    await this.employmentRelationshipRepo.save(relationship);

    return {
      success: true,
      data: { relationshipId: relationship.id.value, state: relationship.state },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: relationship.id,
      newState: relationship.state,
      newVersion: relationship.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(relationship.state, 'EmploymentRelationship'),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
