import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';
import { CountryPolicyValidationRunRepository } from '../repositories/country-policy-validation-run.repository.js';
import { CountryPolicyValidationRun } from '../aggregates/country-policy-validation-run.aggregate.js';
import { CountryPolicyEventsPublisher } from '../events/country-policy-events.publisher.js';

export interface ValidateCountryPolicyPackPayload {
  packId: string;
  validationRunId: string;
  validationType: string;
}

/**
 * Handler for the ValidateCountryPolicyPack command.
 */
@Injectable()
@CommandHandler('ValidateCountryPolicyPack')
export class ValidateCountryPolicyPackHandler implements ICommandHandler {
  readonly commandName = 'ValidateCountryPolicyPack';

  constructor(
    private readonly packRepo: CountryPolicyPackRepository,
    private readonly runRepo: CountryPolicyValidationRunRepository,
    private readonly eventsPublisher: CountryPolicyEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ValidateCountryPolicyPackPayload;
    const pack = await this.packRepo.findById(new Uuid(payload.packId));
    if (!pack) {
      throw new ValidationError('Country policy pack not found');
    }

    const run = CountryPolicyValidationRun.create(
      {
        id: new Uuid(payload.validationRunId),
        tenantId: command.tenantId,
        policyPackId: pack.id,
        validationType: payload.validationType,
      },
      command.correlationId,
    );
    run.start(command.correlationId);

    // Simulate validation logic
    const success = true;
    const results: Record<string, unknown> = { valid: true };

    if (success) {
      run.complete(command.correlationId, results);
      pack.validate(command.correlationId, run.id, true);
    } else {
      run.fail(command.correlationId, 'Validation failed', { errors: [] });
      pack.validate(command.correlationId, run.id, false);
    }

    await this.runRepo.save(run);
    await this.packRepo.save(pack);
    await this.eventsPublisher.publishUncommitted(pack, command.tenantId, command.correlationId);
    await this.eventsPublisher.publishUncommitted(run, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { packId: pack.id.value, status: pack.status, validationRunId: run.id.value },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: pack.id,
      newState: pack.status,
      newVersion: pack.aggregateVersion,
      allowedNextActions: ['RequireImpactSimulation'],
      fieldAccessDecisions: {},
      eventsEmitted: [...pack.domainEvents.map((e) => e.eventName), ...run.domainEvents.map((e) => e.eventName)],
      auditRecordId: Uuid.generate(),
    };
  }
}
