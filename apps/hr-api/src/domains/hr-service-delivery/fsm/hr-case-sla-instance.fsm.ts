import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerHrCaseSlaInstanceFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'HrCaseSlaInstance',
    states: ['ACTIVE', 'BREACHED', 'MET', 'EXEMPTED'],
    actions: ['CreateHrCaseSlaInstance', 'BreachHrCaseSlaInstance', 'MeetHrCaseSlaInstance', 'ExemptHrCaseSlaInstance'],
    transitions: [
      { action: 'CreateHrCaseSlaInstance', from: 'ACTIVE', to: 'ACTIVE', eventName: 'SlaInstanceActivated' },
      { action: 'BreachHrCaseSlaInstance', from: 'ACTIVE', to: 'BREACHED', eventName: 'SlaInstanceBreached' },
      { action: 'MeetHrCaseSlaInstance', from: 'ACTIVE', to: 'MET', eventName: 'SlaInstanceMet' },
      { action: 'ExemptHrCaseSlaInstance', from: 'ACTIVE', to: 'EXEMPTED', eventName: 'SlaInstanceExempted' },
      { action: 'ExemptHrCaseSlaInstance', from: 'BREACHED', to: 'EXEMPTED', eventName: 'SlaInstanceExempted' },
    ],
    initialState: 'ACTIVE',
    terminalStates: ['BREACHED', 'MET', 'EXEMPTED'],
  };
  fsm.register(definition);
}
