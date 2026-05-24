import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerContractorRateCardFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'ContractorRateCard',
    states: ['DRAFT', 'ACTIVE', 'REVISED', 'EXPIRED'],
    actions: ['CreateContractorRateCard', 'ActivateContractorRateCard', 'ReviseContractorRateCard', 'ExpireContractorRateCard'],
    transitions: [
      { action: 'CreateContractorRateCard', from: 'DRAFT', to: 'DRAFT', eventName: 'RateCardCreated' },
      { action: 'ActivateContractorRateCard', from: 'DRAFT', to: 'ACTIVE', eventName: 'RateCardActivated' },
      { action: 'ReviseContractorRateCard', from: 'ACTIVE', to: 'REVISED', eventName: 'RateCardRevised' },
      { action: 'ExpireContractorRateCard', from: 'ACTIVE', to: 'EXPIRED', eventName: 'RateCardExpired' },
      { action: 'ExpireContractorRateCard', from: 'REVISED', to: 'EXPIRED', eventName: 'RateCardExpired' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['EXPIRED'],
  };
  fsm.register(definition);
}
