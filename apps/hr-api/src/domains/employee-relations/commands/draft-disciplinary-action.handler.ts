import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { toDate, toUuid } from '../../common/uuid-normalizer.js';
import { DisciplinaryAction } from '../aggregates/disciplinary-action.aggregate.js';
import { DisciplinaryActionRepository } from '../repositories/disciplinary-action.repository.js';
import { EmployeeRelationsEventsPublisher } from '../events/employee-relations-events.publisher.js';

@CommandHandler('DraftDisciplinaryAction')
@Injectable()
export class DraftDisciplinaryActionHandler {
  constructor(
    private readonly repo: DisciplinaryActionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: EmployeeRelationsEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid | string;
      erCaseId: Uuid | string;
      actionType: string;
      severity: string;
      description: string;
      effectiveDate: Date | string;
    };
    const ar = DisciplinaryAction.draft(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: toUuid(payload.workerId),
        erCaseId: toUuid(payload.erCaseId),
        actionType: payload.actionType,
        severity: payload.severity,
        description: payload.description,
        effectiveDate: toDate(payload.effectiveDate),
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { disciplinaryActionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'DisciplinaryAction'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
