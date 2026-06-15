import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { toOptionalDate, toOptionalUuid, toUuid } from '../../common/uuid-normalizer.js';
import { HrCaseTask } from '../aggregates/hr-case-task.aggregate.js';
import { HrCaseTaskRepository } from '../repositories/hr-case-task.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('CreateHrCaseTask')
@Injectable()
export class CreateHrCaseTaskHandler {
  constructor(
    private readonly repo: HrCaseTaskRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { caseId: Uuid | string; title: string; assignedTo?: Uuid | string; dueDate?: Date | string };
    const ar = HrCaseTask.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        caseId: toUuid(payload.caseId),
        title: payload.title,
        assignedTo: toOptionalUuid(payload.assignedTo),
        dueDate: toOptionalDate(payload.dueDate),
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrCaseTaskId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrCaseTask'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
