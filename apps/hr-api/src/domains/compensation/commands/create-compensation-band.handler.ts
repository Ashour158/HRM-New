import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CompensationBandRepository } from '../repositories/compensation-band.repository.js';
import { CompensationBand } from '../aggregates/compensation-band.aggregate.js';
import { CompensationBandFsm } from '../fsm/compensation-band.fsm.js';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

/**
 * Command handler for creating a new CompensationBand.
 */
@Injectable()
@CommandHandler('CreateCompensationBand')
export class CreateCompensationBandHandler implements ICommandHandler {
  commandName = 'CreateCompensationBand' as const;

  constructor(
    private readonly repo: CompensationBandRepository,
    private readonly publisher: CompensationEventsPublisher,
    private readonly fsm: CompensationBandFsm,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      bandId: Uuid;
      bandCode: string;
      jobLevel: string;
      jobFamily: string;
      minSalary: number;
      midSalary: number;
      maxSalary: number;
      currency: string;
    };

    const band = CompensationBand.create({
      id: payload.bandId,
      tenantId: command.tenantId,
      bandCode: payload.bandCode,
      jobLevel: payload.jobLevel,
      jobFamily: payload.jobFamily,
      minSalary: payload.minSalary,
      midSalary: payload.midSalary,
      maxSalary: payload.maxSalary,
      currency: payload.currency,
      correlationId: command.correlationId,
    });

    await this.repo.save(band);
    const eventsEmitted = band.domainEvents.map((e) => e.eventName);
    await this.publisher.publishAll(band, command);

    return {
      success: true,
      data: { bandId: band.id.value, status: band.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: band.id,
      newState: band.status,
      newVersion: band.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActions(band.status),
      fieldAccessDecisions: {},
      eventsEmitted,
      auditRecordId: command.commandId,
    };
  }
}
