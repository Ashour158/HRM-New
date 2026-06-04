import { Injectable, NotFoundException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { PositionRepository } from '../repositories/position.repository.js';

export interface UpdatePositionCommandPayload {
  positionId: string;
  title?: string;
  departmentId?: string;
  legalEntityId?: string;
  jobFamily?: string;
  jobLevel?: string;
  employmentType?: string;
}

/**
 * Handler for the UpdatePosition command.
 */
@Injectable()
@CommandHandler('UpdatePosition')
export class UpdatePositionHandler implements ICommandHandler {
  readonly commandName = 'UpdatePosition';

  constructor(
    private readonly positionRepo: PositionRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as UpdatePositionCommandPayload;
    const position = await this.positionRepo.findById(new Uuid(payload.positionId));
    if (!position) {
      throw new NotFoundException('Position not found');
    }

    position.update(
      {
        title: payload.title,
        departmentId: payload.departmentId ? new Uuid(payload.departmentId) : undefined,
        legalEntityId: payload.legalEntityId ? new Uuid(payload.legalEntityId) : undefined,
        jobFamily: payload.jobFamily,
        jobLevel: payload.jobLevel,
        employmentType: payload.employmentType,
      },
      command.correlationId,
    );
    await this.positionRepo.save(position);

    return {
      success: true,
      data: { positionId: position.id.value, status: position.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: position.id,
      newState: position.status,
      newVersion: position.version,
      allowedNextActions: [], // populated by FSM
      fieldAccessDecisions: {},
      eventsEmitted: ['PositionUpdated'],
      auditRecordId: Uuid.generate(),
    };
  }
}
