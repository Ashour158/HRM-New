import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { toOptionalUuid, toUuid } from '../../common/uuid-normalizer.js';
import { EmployeeRelationsCase } from '../aggregates/employee-relations-case.aggregate.js';
import { EmployeeRelationsCaseRepository } from '../repositories/employee-relations-case.repository.js';
import { EmployeeRelationsEventsPublisher } from '../events/employee-relations-events.publisher.js';

@CommandHandler('CreateEmployeeRelationsCase')
@Injectable()
export class CreateEmployeeRelationsCaseHandler {
  constructor(
    private readonly repo: EmployeeRelationsCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: EmployeeRelationsEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      caseNumber: string;
      subjectWorkerId: Uuid | string;
      caseType: string;
      severity: string;
      description: string;
      openedBy: Uuid | string;
      assignedTo?: Uuid | string;
    };
    const ar = EmployeeRelationsCase.open(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        caseNumber: payload.caseNumber,
        subjectWorkerId: toUuid(payload.subjectWorkerId),
        caseType: payload.caseType,
        severity: payload.severity,
        description: payload.description,
        openedBy: toUuid(payload.openedBy),
        assignedTo: toOptionalUuid(payload.assignedTo),
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { employeeRelationsCaseId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'EmployeeRelationsCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
