import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerHrCaseTaskFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'HrCaseTask',
    states: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'],
    actions: ['CreateHrCaseTask', 'StartHrCaseTask', 'CompleteHrCaseTask', 'MarkOverdueHrCaseTask', 'CancelHrCaseTask'],
    transitions: [
      { action: 'CreateHrCaseTask', from: 'PENDING', to: 'PENDING', eventName: 'HrCaseTaskCreated' },
      { action: 'StartHrCaseTask', from: 'PENDING', to: 'IN_PROGRESS', eventName: 'HrCaseTaskStarted' },
      { action: 'CompleteHrCaseTask', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'HrCaseTaskCompleted' },
      { action: 'CompleteHrCaseTask', from: 'PENDING', to: 'COMPLETED', eventName: 'HrCaseTaskCompleted' },
      { action: 'MarkOverdueHrCaseTask', from: 'PENDING', to: 'OVERDUE', eventName: 'HrCaseTaskOverdue' },
      { action: 'MarkOverdueHrCaseTask', from: 'IN_PROGRESS', to: 'OVERDUE', eventName: 'HrCaseTaskOverdue' },
      { action: 'CancelHrCaseTask', from: 'PENDING', to: 'CANCELLED', eventName: 'HrCaseTaskCancelled' },
      { action: 'CancelHrCaseTask', from: 'IN_PROGRESS', to: 'CANCELLED', eventName: 'HrCaseTaskCancelled' },
      { action: 'CancelHrCaseTask', from: 'OVERDUE', to: 'CANCELLED', eventName: 'HrCaseTaskCancelled' },
    ],
    initialState: 'PENDING',
    terminalStates: ['COMPLETED', 'CANCELLED'],
  };
  fsm.register(definition);
}
