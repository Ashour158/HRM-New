import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the CountryRuleSet aggregate.
 *
 * States: DRAFT, ACTIVE, SUPERSEDED, RETIRED
 */
@Injectable()
export class CountryRuleSetFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'CountryRuleSet',
      states: ['DRAFT', 'ACTIVE', 'SUPERSEDED', 'RETIRED'],
      actions: ['ActivateCountryRuleSet', 'SupersedeCountryRuleSet', 'RetireCountryRuleSet'],
      transitions: [
        { action: 'ActivateCountryRuleSet', from: 'DRAFT', to: 'ACTIVE', eventName: 'CountryRuleSetActivated' },
        { action: 'SupersedeCountryRuleSet', from: 'ACTIVE', to: 'SUPERSEDED', eventName: 'CountryRuleSetSuperseded' },
        { action: 'RetireCountryRuleSet', from: 'ACTIVE', to: 'RETIRED', eventName: 'CountryRuleSetRetired' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['SUPERSEDED', 'RETIRED'],
    });
  }
}
