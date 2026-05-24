import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CreateWorkerPayload } from '@hcm/command-contracts';
import { Uuid, Email, ValidationError } from '@hcm/shared-kernel';
import { FieldAccessDecision, FieldPolicyEngine, type AbacContext } from '@hcm/access-control';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerProfile } from '../aggregates/worker-profile.aggregate.js';
import { EmploymentRelationship } from '../aggregates/employment-relationship.aggregate.js';
import { PersonalDataRecord } from '../aggregates/personal-data-record.aggregate.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { EmploymentRelationshipRepository } from '../repositories/employment-relationship.repository.js';
import { PersonalDataRecordRepository } from '../repositories/personal-data-record.repository.js';
import { WorkerEventsPublisher } from '../events/worker-events.publisher.js';

function mapFieldDecision(decision: FieldAccessDecision): 'VISIBLE' | 'MASKED' | 'HIDDEN' | 'DENIED' {
  switch (decision) {
    case FieldAccessDecision.VISIBLE:
      return 'VISIBLE';
    case FieldAccessDecision.MASKED:
      return 'MASKED';
    case FieldAccessDecision.HIDDEN:
      return 'HIDDEN';
    default:
      return 'DENIED';
  }
}

function buildFieldAccessDecisions(
  fieldPolicy: FieldPolicyEngine,
  roles: string[],
  abacContext: AbacContext,
): Record<string, 'VISIBLE' | 'MASKED' | 'HIDDEN' | 'DENIED'> {
  const decisions: Record<string, 'VISIBLE' | 'MASKED' | 'HIDDEN' | 'DENIED'> = {};
  const fields = ['worker.name', 'worker.email', 'worker.ssn', 'worker.compensation.salary'];
  for (const field of fields) {
    const result = fieldPolicy.evaluateFieldAccess(field, roles, abacContext, 'CONFIDENTIAL');
    decisions[field] = mapFieldDecision(result.decision);
  }
  return decisions;
}

/**
 * Handler for the CreateWorker command.
 */
@CommandHandler('CreateWorker')
@Injectable()
export class CreateWorkerHandler {
  private readonly fieldPolicy = new FieldPolicyEngine();

  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly employmentRelationshipRepo: EmploymentRelationshipRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: WorkerEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateWorkerPayload;

    if (payload.email) {
      const existing = await this.workerRepo.findByEmail(payload.email);
      if (existing) {
        throw new ValidationError('Email already in use');
      }
    }

    const employeeNumber = `EMP-${command.tenantId.value.slice(0, 8)}-${Date.now()}`;
    const email = payload.email ? new Email(payload.email) : new Email('unknown@example.com');

    const worker = WorkerProfile.create(
      {
        id: payload.workerId,
        tenantId: command.tenantId,
        employeeNumber,
        status: 'DRAFT',
        firstName: payload.firstName,
        lastName: payload.lastName,
        email,
        hireDate: command.effectiveDate ?? new Date(),
        employmentType: 'FULL_TIME',
      },
      command.correlationId,
    );

    await this.workerRepo.save(worker);

    if (command.effectiveDate) {
      const relationship = EmploymentRelationship.create(
        {
          id: Uuid.generate(),
          tenantId: command.tenantId,
          workerId: worker.id,
          relationshipType: 'EMPLOYEE',
          startDate: command.effectiveDate,
          state: 'DRAFT',
        },
        command.correlationId,
      );
      await this.employmentRelationshipRepo.save(relationship);
    }

    if (payload.dateOfBirth || (payload as unknown as Record<string, unknown>).phoneNumber) {
      const record = PersonalDataRecord.create(
        {
          id: Uuid.generate(),
          tenantId: command.tenantId,
          workerId: worker.id,
          dataCategory: 'BASIC',
          dataClassification: 'CONFIDENTIAL',
          payload: {
            dateOfBirth: payload.dateOfBirth?.toISOString(),
            phoneNumber: (payload as unknown as Record<string, unknown>).phoneNumber,
          },
          consentStatus: 'GRANTED',
          state: 'DRAFT',
        },
        command.correlationId,
      );
      await this.personalDataRepo.save(record);
    }

    await this.eventPublisher.publishFromAggregate(worker);

    const abacContext: AbacContext = {
      subjectWorkerId: command.subjectWorkerId,
      actorWorkerId: command.actor.actorId,
      isSelf: command.subjectWorkerId?.value === command.actor.actorId.value,
      isManager: false,
      isManagerChain: false,
      isPeer: false,
      legalEntityIds: [],
      countryCodes: [],
      departmentIds: [],
      timeOfAccess: new Date(),
      breakGlassActive: false,
      mfaAuthenticated: command.actor.mfaAuthenticated,
    };

    return {
      success: true,
      data: { workerId: worker.id.value, status: worker.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: worker.id,
      newState: worker.status,
      newVersion: worker.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(worker.status, 'WorkerProfile'),
      fieldAccessDecisions: buildFieldAccessDecisions(this.fieldPolicy, command.actor.roles, abacContext),
      eventsEmitted: worker.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
