import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface OpenJobRequisitionCommandPayload {
  requisitionId: Uuid;
}

/**
 * Handler for the OpenJobRequisition command.
 *
 * Transitions a requisition from PUBLISHED to OPEN, making it eligible to
 * receive candidate applications via SubmitCandidateApplication.
 */
@Injectable()
@CommandHandler('OpenJobRequisition')
export class OpenJobRequisitionHandler implements ICommandHandler {
  readonly commandName = 'OpenJobRequisition';

  constructor(
    private readonly requisitionRepo: JobRequisitionRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as OpenJobRequisitionCommandPayload;
    const requisition = await this.requisitionRepo.findById(payload.requisitionId);
    if (!requisition) {
      throw new NotFoundException('Job requisition not found');
    }

    if (requisition.status === 'OPEN') {
      // Idempotent retry: the requisition is already in the target state,
      // so return the existing outcome instead of re-invoking `open()`,
      // which would throw ConflictError on a retried command.
      return {
        success: true,
        data: { requisitionId: requisition.id.value, status: requisition.status },
        commandId: command.commandId,
        correlationId: command.correlationId,
        aggregateId: requisition.id,
        newState: requisition.status,
        newVersion: requisition.aggregateVersion,
        allowedNextActions: this.fsm.getAllowedActionsFromState(requisition.status, 'JobRequisition'),
        fieldAccessDecisions: {},
        eventsEmitted: [],
        auditRecordId: command.commandId,
      };
    }

    requisition.open(command.correlationId);
    await this.requisitionRepo.save(requisition);
    await this.eventPublisher.publishUncommitted(requisition, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { requisitionId: requisition.id.value, status: requisition.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: requisition.id,
      newState: requisition.status,
      newVersion: requisition.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(requisition.status, 'JobRequisition'),
      fieldAccessDecisions: {},
      eventsEmitted: ['JobRequisitionOpened'],
      auditRecordId: command.commandId,
    };
  }
}
