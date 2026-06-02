import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCase } from '../aggregates/hr-service-case.aggregate.js';
import { HrServiceCaseRepository } from '../repositories/hr-service-case.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('OpenHrServiceCase')
@Injectable()
export class OpenHrServiceCaseHandler {
  constructor(
    private readonly repo: HrServiceCaseRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      caseNumber: string;
      requesterWorkerId: Uuid | string;
      caseType: string;
      priority: string;
      description: string;
      assignedTo?: Uuid | string;
      slaDeadline?: Date | string;
    };
    const ar = HrServiceCase.open(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        ...payload,
        requesterWorkerId: payload.requesterWorkerId instanceof Uuid
          ? payload.requesterWorkerId
          : new Uuid(payload.requesterWorkerId),
        assignedTo: payload.assignedTo
          ? payload.assignedTo instanceof Uuid
            ? payload.assignedTo
            : new Uuid(payload.assignedTo)
          : undefined,
        slaDeadline: payload.slaDeadline
          ? payload.slaDeadline instanceof Date
            ? payload.slaDeadline
            : new Date(payload.slaDeadline)
          : undefined,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: {
        hrServiceCaseId: ar.id.value,
        caseNumber: ar.caseNumber,
        caseType: ar.caseType,
        priority: ar.priority,
        status: ar.status,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
