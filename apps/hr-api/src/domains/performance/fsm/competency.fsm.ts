import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerCompetencyFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'Competency',
    states: ['DRAFT', 'ACTIVE', 'INACTIVE'],
    actions: ['CreateCompetency', 'ActivateCompetency', 'DeactivateCompetency'],
    transitions: [
      { action: 'CreateCompetency', from: 'DRAFT', to: 'DRAFT', eventName: 'CompetencyCreated' },
      { action: 'ActivateCompetency', from: 'DRAFT', to: 'ACTIVE', eventName: 'CompetencyActivated' },
      { action: 'ActivateCompetency', from: 'INACTIVE', to: 'ACTIVE', eventName: 'CompetencyActivated' },
      { action: 'DeactivateCompetency', from: 'ACTIVE', to: 'INACTIVE', eventName: 'CompetencyDeactivated' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['INACTIVE'],
  };
  fsm.register(definition);
}
