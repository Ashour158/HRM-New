import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid } from '@hcm/shared-kernel';
import { CountryRuleSet } from '../aggregates/country-rule-set.aggregate.js';
import { CountryRuleSetRepository } from '../repositories/country-rule-set.repository.js';
import { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';

export interface CreateCountryRuleSetPayload {
  ruleSetId: string;
  countryCode: string;
  ruleSetType: string;
  version: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  rules: Record<string, unknown>;
}

/**
 * Handler for the CreateCountryRuleSet command.
 */
@Injectable()
@CommandHandler('CreateCountryRuleSet')
export class CreateCountryRuleSetHandler implements ICommandHandler {
  readonly commandName = 'CreateCountryRuleSet';

  constructor(
    private readonly repo: CountryRuleSetRepository,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateCountryRuleSetPayload;

    const ruleSet = CountryRuleSet.create(
      {
        id: new Uuid(payload.ruleSetId),
        tenantId: command.tenantId,
        countryCode: payload.countryCode,
        ruleSetType: payload.ruleSetType,
        ruleSetVersion: payload.version,
        effectiveFrom: payload.effectiveFrom,
        effectiveUntil: payload.effectiveUntil,
        rules: payload.rules,
      },
      command.correlationId,
    );

    await this.repo.save(ruleSet);
    await this.eventsPublisher.publishUncommitted(ruleSet, command.tenantId, command.correlationId);

    return {
      success: true,
      data: { ruleSetId: ruleSet.id.value, status: ruleSet.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ruleSet.id,
      newState: ruleSet.status,
      newVersion: ruleSet.aggregateVersion,
      allowedNextActions: ['ActivateCountryRuleSet'],
      fieldAccessDecisions: {},
      eventsEmitted: ruleSet.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
