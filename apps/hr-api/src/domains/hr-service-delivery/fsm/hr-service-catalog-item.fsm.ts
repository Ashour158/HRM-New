import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerHrServiceCatalogItemFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'HrServiceCatalogItem',
    states: ['ACTIVE', 'SUSPENDED', 'RETIRED'],
    actions: ['CreateHrServiceCatalogItem', 'ActivateHrServiceCatalogItem', 'SuspendHrServiceCatalogItem', 'RetireHrServiceCatalogItem'],
    transitions: [
      { action: 'CreateHrServiceCatalogItem', from: 'ACTIVE', to: 'ACTIVE', eventName: 'HrServiceCatalogItemCreated' },
      { action: 'ActivateHrServiceCatalogItem', from: 'SUSPENDED', to: 'ACTIVE', eventName: 'HrServiceCatalogItemActivated' },
      { action: 'SuspendHrServiceCatalogItem', from: 'ACTIVE', to: 'SUSPENDED', eventName: 'HrServiceCatalogItemSuspended' },
      { action: 'RetireHrServiceCatalogItem', from: 'ACTIVE', to: 'RETIRED', eventName: 'HrServiceCatalogItemRetired' },
      { action: 'RetireHrServiceCatalogItem', from: 'SUSPENDED', to: 'RETIRED', eventName: 'HrServiceCatalogItemRetired' },
    ],
    initialState: 'ACTIVE',
    terminalStates: ['RETIRED'],
  };
  fsm.register(definition);
}
