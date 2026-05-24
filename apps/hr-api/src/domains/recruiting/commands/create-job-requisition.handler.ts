import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { JobRequisition } from '../aggregates/job-requisition.aggregate.js';
import { JobRequisitionRepository } from '../repositories/job-requisition.repository.js';
import { PositionRepository } from '../../position-control/repositories/position.repository.js';
import { RecruitingEventsPublisher } from '../events/recruiting-events.publisher.js';

export interface CreateJobRequisitionCommandPayload {
  requisitionId: Uuid;
  positionId: Uuid;
  title: string;
  description?: string;
}

/**
 * Handler for the CreateJobRequisition command.
 *
 * Validates that the referenced position is ACTIVE and VACANT before
 * creating the requisition in DRAFT state.
 */
@Injectable()
@CommandHandler('CreateJobRequisition')
export class CreateJobRequisitionHandler implements ICommandHandler {
  readonly commandName = 'CreateJobRequisition';

  constructor(
    private readonly requisitionRepo: JobRequisitionRepository,
    private readonly positionRepo: PositionRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: RecruitingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateJobRequisitionCommandPayload;

    const position = await this.positionRepo.findById(payload.positionId);
    if (!position) {
      throw new NotFoundException('Position not found');
    }
    if (position.status !== 'ACTIVE' && position.status !== 'VACANT') {
      throw new BadRequestException(
        `Position must be ACTIVE or VACANT to open a requisition. Current status: ${position.status}`,
      );
    }

    const existing = await this.requisitionRepo.findByRequisitionNumber(payload.requisitionId.value);
    if (existing) {
      throw new ValidationError('Requisition number already exists');
    }

    const requisition = JobRequisition.create(
      {
        id: payload.requisitionId,
        tenantId: command.tenantId,
        requisitionNumber: `REQ-${command.tenantId.value.slice(0, 8)}-${Date.now()}`,
        positionId: payload.positionId,
        departmentId: position.departmentId,
        title: payload.title,
        description: payload.description,
      },
      command.correlationId,
    );

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
      eventsEmitted: ['JobRequisitionCreated'],
      auditRecordId: Uuid.generate(),
    };
  }
}
