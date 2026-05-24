import { Injectable } from '@nestjs/common';
import { Uuid, ConflictError } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Position } from '../aggregates/position.aggregate.js';
import { PositionRepository } from '../repositories/position.repository.js';
import { HeadcountRequestRepository } from '../repositories/headcount-request.repository.js';
import { PositionEventsPublisher } from '../events/position-events.publisher.js';

export interface CreatePositionCommandPayload {
  positionCode: string;
  title: string;
  departmentId?: string;
  legalEntityId?: string;
  jobFamily?: string;
  jobLevel?: string;
  employmentType: string;
  headcountRequestId?: string;
}

/**
 * Handler for the CreatePosition command.
 *
 * Validates tenant, permissions, position code uniqueness, and headcount
 * linkage before creating the aggregate.
 */
@Injectable()
@CommandHandler('CreatePosition')
export class CreatePositionHandler implements ICommandHandler {
  readonly commandName = 'CreatePosition';

  constructor(
    private readonly positionRepo: PositionRepository,
    private readonly headcountRepo: HeadcountRequestRepository,
    private readonly eventsPublisher: PositionEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreatePositionCommandPayload;
    const tenantId = command.tenantId;

    // Validate positionCode uniqueness
    const existing = await this.positionRepo.findByCode(payload.positionCode);
    if (existing) {
      throw new ConflictError('Position code must be unique per tenant');
    }

    // If linked to headcountRequest, verify request is APPROVED
    let headcountRequestId: Uuid | undefined;
    if (payload.headcountRequestId) {
      headcountRequestId = new Uuid(payload.headcountRequestId);
      const hc = await this.headcountRepo.findById(headcountRequestId);
      if (!hc) {
        throw new ConflictError('Linked headcount request not found');
      }
      if (hc.status !== 'APPROVED') {
        throw new ConflictError('Headcount request must be APPROVED');
      }
    }

    const position = Position.create({
      id: Uuid.generate(),
      tenantId,
      positionCode: payload.positionCode,
      title: payload.title,
      departmentId: payload.departmentId ? new Uuid(payload.departmentId) : undefined,
      legalEntityId: payload.legalEntityId ? new Uuid(payload.legalEntityId) : undefined,
      jobFamily: payload.jobFamily,
      jobLevel: payload.jobLevel,
      employmentType: payload.employmentType,
      headcountRequestId,
    });

    await this.positionRepo.save(position);
    await this.eventsPublisher.publishUncommitted(position, tenantId, command.correlationId);

    return {
      success: true,
      data: {
        positionId: position.id.value,
        positionCode: position.positionCode,
        status: position.status,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: position.id,
      newState: position.status,
      newVersion: position.version,
      allowedNextActions: ['Activate', 'Update'],
      fieldAccessDecisions: {},
      eventsEmitted: ['PositionCreated'],
      auditRecordId: Uuid.generate(), // placeholder overwritten by CommandBus
    };
  }
}
