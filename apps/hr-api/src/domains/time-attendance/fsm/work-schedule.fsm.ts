import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerWorkScheduleFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'WorkSchedule',
    states: ['DRAFT', 'ACTIVE', 'EXPIRED'],
    actions: ['CreateWorkSchedule', 'ActivateWorkSchedule', 'ExpireWorkSchedule'],
    transitions: [
      { action: 'CreateWorkSchedule', from: 'DRAFT', to: 'DRAFT', eventName: 'WorkScheduleCreated' },
      { action: 'ActivateWorkSchedule', from: 'DRAFT', to: 'ACTIVE', eventName: 'WorkScheduleActivated' },
      { action: 'ExpireWorkSchedule', from: 'ACTIVE', to: 'EXPIRED', eventName: 'WorkScheduleExpired' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['EXPIRED'],
  };
  fsm.register(definition);
}
