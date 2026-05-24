import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { CountryPolicyPack } from '../aggregates/country-policy-pack.aggregate.js';
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';
import { CountryPolicyEventsPublisher } from '../events/country-policy-events.publisher.js';

export interface UploadCountryPolicyPackPayload {
  packId: string;
  countryCode: string;
  version: string;
  effectiveFrom: Date;
  sections?: Record<string, unknown>;
  uploadedBy: string;
}

/**
 * Handler for the UploadCountryPolicyPack command.
 */
@Injectable()
@CommandHandler('UploadCountryPolicyPack')
export class UploadCountryPolicyPackHandler implements ICommandHandler {
  readonly commandName = 'UploadCountryPolicyPack';

  constructor(
    private readonly repo: CountryPolicyPackRepository,
    private readonly eventsPublisher: CountryPolicyEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as UploadCountryPolicyPackPayload;

    const pack = CountryPolicyPack.create(
      {
        id: new Uuid(payload.packId),
        tenantId: command.tenantId,
        countryCode: payload.countryCode,
        countryPackVersion: payload.version,
        effectiveFrom: payload.effectiveFrom,
        sections: payload.sections,
      },
      command.correlationId,
    );

    pack.upload(new Uuid(payload.uploadedBy), command.correlationId);
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
      allowedNextActions: ['ParseCountryPolicyPack'],
      fieldAccessDecisions: {},
      eventsEmitted: pack.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
