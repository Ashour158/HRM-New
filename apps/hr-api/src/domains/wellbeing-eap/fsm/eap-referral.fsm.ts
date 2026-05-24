import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerEapReferralFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'EapReferral',
    states: ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'],
    actions: ['CreateEapReferral', 'ScheduleEapReferral', 'StartEapReferral', 'CompleteEapReferral', 'CloseEapReferral', 'CancelEapReferral'],
    transitions: [
      { action: 'CreateEapReferral', from: '', to: 'REQUESTED', eventName: 'EapReferralCreated' },
      { action: 'ScheduleEapReferral', from: 'REQUESTED', to: 'SCHEDULED', eventName: 'EapReferralScheduled' },
      { action: 'StartEapReferral', from: 'SCHEDULED', to: 'IN_PROGRESS', eventName: 'EapReferralStarted' },
      { action: 'CompleteEapReferral', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'EapReferralCompleted' },
      { action: 'CloseEapReferral', from: 'COMPLETED', to: 'CLOSED', eventName: 'EapReferralClosed' },
      { action: 'CancelEapReferral', from: 'REQUESTED', to: 'CANCELLED', eventName: 'EapReferralCancelled' },
      { action: 'CancelEapReferral', from: 'SCHEDULED', to: 'CANCELLED', eventName: 'EapReferralCancelled' },
      { action: 'CloseEapReferral', from: 'CANCELLED', to: 'CLOSED', eventName: 'EapReferralClosed' },
    ],
    initialState: 'REQUESTED',
    terminalStates: ['CLOSED'],
  };
  fsm.register(definition);
}
