import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CountryRuleSetRepository } from '../repositories/country-rule-set.repository.js';
import { GlobalHrEventsPublisher } from '../events/global-hr-events.publisher.js';

type CountryRuleSetTransitionPayload = {
  ruleSetId: Uuid;
  supersededBy?: string;
};

function countryRuleSetResult(
  command: HrCommandEnvelope<unknown>,
  fsm: FsmFramework,
  ruleSet: Awaited<ReturnType<CountryRuleSetRepository['findById']>>,
): CommandResult<unknown> {
  if (!ruleSet) throw new Error('Country rule set not found');
  return {
    success: true,
    data: { ruleSetId: ruleSet.id.value, status: ruleSet.status },
    commandId: command.commandId,
    correlationId: command.correlationId,
    aggregateId: ruleSet.id,
    newState: ruleSet.status,
    newVersion: ruleSet.aggregateVersion,
    allowedNextActions: fsm.getAllowedActionsFromState(ruleSet.status, 'CountryRuleSet'),
    fieldAccessDecisions: {},
    eventsEmitted: ruleSet.domainEvents.map((event) => event.eventName),
    auditRecordId: command.commandId,
  };
}

/**
 * Activates a CountryRuleSet (DRAFT → ACTIVE).
 */
@CommandHandler('ActivateCountryRuleSet')
@Injectable()
export class ActivateCountryRuleSetHandler {
  readonly commandName = 'ActivateCountryRuleSet';

  constructor(
    private readonly repo: CountryRuleSetRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CountryRuleSetTransitionPayload;
    const ruleSet = await this.repo.findById(payload.ruleSetId);
    if (!ruleSet) throw new Error('Country rule set not found');
    ruleSet.activate(command.correlationId);
    await this.repo.save(ruleSet);
    await this.eventsPublisher.publishUncommitted(ruleSet, command.tenantId, command.correlationId);
    return countryRuleSetResult(command, this.fsm, ruleSet);
  }
}

/**
 * Supersedes a CountryRuleSet (ACTIVE → SUPERSEDED), typically because a newer
 * version of the rule set has been activated in its place.
 */
@CommandHandler('SupersedeCountryRuleSet')
@Injectable()
export class SupersedeCountryRuleSetHandler {
  readonly commandName = 'SupersedeCountryRuleSet';

  constructor(
    private readonly repo: CountryRuleSetRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CountryRuleSetTransitionPayload;
    const ruleSet = await this.repo.findById(payload.ruleSetId);
    if (!ruleSet) throw new Error('Country rule set not found');
    ruleSet.supersede(command.correlationId, payload.supersededBy);
    await this.repo.save(ruleSet);
    await this.eventsPublisher.publishUncommitted(ruleSet, command.tenantId, command.correlationId);
    return countryRuleSetResult(command, this.fsm, ruleSet);
  }
}

/**
 * Retires a CountryRuleSet (ACTIVE → RETIRED) without a successor rule set.
 */
@CommandHandler('RetireCountryRuleSet')
@Injectable()
export class RetireCountryRuleSetHandler {
  readonly commandName = 'RetireCountryRuleSet';

  constructor(
    private readonly repo: CountryRuleSetRepository,
    private readonly fsm: FsmFramework,
    private readonly eventsPublisher: GlobalHrEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CountryRuleSetTransitionPayload;
    const ruleSet = await this.repo.findById(payload.ruleSetId);
    if (!ruleSet) throw new Error('Country rule set not found');
    ruleSet.retire(command.correlationId);
    await this.repo.save(ruleSet);
    await this.eventsPublisher.publishUncommitted(ruleSet, command.tenantId, command.correlationId);
    return countryRuleSetResult(command, this.fsm, ruleSet);
  }
}
