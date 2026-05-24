import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';
import { CountryPolicyEventsPublisher } from '../events/country-policy-events.publisher.js';

export interface ApproveCountryPolicyPackPayload {
  packId: string;
  approvedBy: string;
}

/**
 * Handler for the ApproveCountryPolicyPack command.
 */
@Injectable()
@CommandHandler('ApproveCountryPolicyPack')
export class ApproveCountryPolicyPackHandler implements ICommandHandler {
  readonly commandName = 'ApproveCountryPolicyPack';

  constructor(
    private readonly repo: CountryPolicyPackRepository,
    private readonly eventsPublisher: CountryPolicyEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ApproveCountryPolicyPackPayload;
    const pack = await this.repo.findById(new Uuid(payload.packId));
    if (!pack) {
      throw new ValidationError('Country policy pack not found');
    }

    pack.approve(new Uuid(payload.approvedBy), command.correlationId);
    await this.repo.save(pack);
    await this.eventsPublisher.publishUncommitted(pack, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { packId: pack.id.value, status: pack.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: pack.id,
      newState: pack.status,
      newVersion: pack.aggregateVersion,
      allowedNextActions: ['ScheduleCountryPolicyPackPublication'],
      fieldAccessDecisions: {},
      eventsEmitted: pack.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
