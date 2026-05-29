import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerKeyResultFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'KeyResult',
    states: ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'ACHIEVED', 'PARTIAL', 'MISSED', 'CANCELLED'],
    actions: ['CreateKeyResult', 'ActivateKeyResult', 'UpdateKeyResultProgress', 'CompleteKeyResult', 'CancelKeyResult'],
    transitions: [
      { action: 'CreateKeyResult', from: 'DRAFT', to: 'DRAFT', eventName: 'KeyResultCreated' },
      { action: 'ActivateKeyResult', from: 'DRAFT', to: 'ACTIVE', eventName: 'KeyResultActivated' },
      { action: 'UpdateKeyResultProgress', from: 'ACTIVE', to: 'IN_PROGRESS', eventName: 'KeyResultProgressUpdated' },
      { action: 'UpdateKeyResultProgress', from: 'IN_PROGRESS', to: 'IN_PROGRESS', eventName: 'KeyResultProgressUpdated' },
      { action: 'UpdateKeyResultProgress', from: 'IN_PROGRESS', to: 'ACHIEVED', eventName: 'KeyResultAchieved' },
      { action: 'CompleteKeyResult', from: 'ACTIVE', to: 'ACHIEVED', eventName: 'KeyResultAchieved' },
      { action: 'CompleteKeyResult', from: 'IN_PROGRESS', to: 'ACHIEVED', eventName: 'KeyResultAchieved' },
      { action: 'CancelKeyResult', from: 'DRAFT', to: 'CANCELLED', eventName: 'KeyResultCancelled' },
      { action: 'CancelKeyResult', from: 'ACTIVE', to: 'CANCELLED', eventName: 'KeyResultCancelled' },
      { action: 'CancelKeyResult', from: 'IN_PROGRESS', to: 'CANCELLED', eventName: 'KeyResultCancelled' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ACHIEVED', 'PARTIAL', 'MISSED', 'CANCELLED'],
  };
  fsm.register(definition);
}
