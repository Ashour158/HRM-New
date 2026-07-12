import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';

export interface RejectCountryPolicyPackPayload {
  packId: string;
}

/**
 * Handler for the RejectCountryPolicyPack command.
 */
@Injectable()
@CommandHandler('RejectCountryPolicyPack')
export class RejectCountryPolicyPackHandler implements ICommandHandler {
  readonly commandName = 'RejectCountryPolicyPack';

  constructor(
    private readonly repo: CountryPolicyPackRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as RejectCountryPolicyPackPayload;
    const pack = await this.repo.findById(new Uuid(payload.packId));
    if (!pack) {
      throw new ValidationError('Country policy pack not found');
    }

    pack.reject(command.correlationId);
    await this.repo.save(pack);

    return {
      success: true,
      data: { packId: pack.id.value, status: pack.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: pack.id,
      newState: pack.status,
      newVersion: pack.aggregateVersion,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: pack.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
