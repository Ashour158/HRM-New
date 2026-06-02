import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { NotFoundError, Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { EmploymentRelationshipRepository } from '../repositories/employment-relationship.repository.js';
import { EmploymentRelationship } from '../aggregates/employment-relationship.aggregate.js';

function toUuid(value: Uuid | string): Uuid {
  return value instanceof Uuid ? value : new Uuid(value);
}

function optionalUuid(value: Uuid | string | undefined): Uuid | undefined {
  if (!value) return undefined;
  return toUuid(value);
}

interface CreateEmploymentRelationshipPayload {
  relationshipId?: Uuid | string;
  workerId: Uuid | string;
  relationshipType: string;
  startDate: Date;
  legalEntityId?: Uuid | string;
  contractType?: string;
  probationEndDate?: Date;
}

@CommandHandler('CreateEmploymentRelationship')
@Injectable()
export class CreateEmploymentRelationshipHandler {
  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly employmentRelationshipRepo: EmploymentRelationshipRepository,
    private readonly fsm: FsmFramework,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateEmploymentRelationshipPayload;
    const workerId = toUuid(payload.workerId as Uuid | string);
    const worker = await this.workerRepo.findByIdForTenant(workerId, command.tenantId);
    if (!worker) throw new NotFoundError('Worker not found');

    const relationship = EmploymentRelationship.create(
      {
        id: optionalUuid(payload.relationshipId as Uuid | string | undefined) ?? Uuid.generate(),
        tenantId: command.tenantId,
        workerId,
        relationshipType: payload.relationshipType,
        startDate: payload.startDate,
        legalEntityId: optionalUuid(payload.legalEntityId as Uuid | string | undefined),
        contractType: payload.contractType,
        probationEndDate: payload.probationEndDate,
        state: 'DRAFT',
      },
      command.correlationId,
    );
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
