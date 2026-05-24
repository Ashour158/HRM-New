import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerRecognitionRecordFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'RecognitionRecord',
    states: ['SUBMITTED', 'APPROVED', 'AWARDED', 'CANCELLED', 'REJECTED'],
    actions: ['CreateRecognitionRecord', 'ApproveRecognitionRecord', 'AwardRecognitionRecord', 'CancelRecognitionRecord', 'RejectRecognitionRecord'],
    transitions: [
      { action: 'CreateRecognitionRecord', from: 'SUBMITTED', to: 'SUBMITTED', eventName: 'RecognitionSubmitted' },
      { action: 'ApproveRecognitionRecord', from: 'SUBMITTED', to: 'APPROVED', eventName: 'RecognitionApproved' },
      { action: 'AwardRecognitionRecord', from: 'APPROVED', to: 'AWARDED', eventName: 'RecognitionAwarded' },
      { action: 'CancelRecognitionRecord', from: 'SUBMITTED', to: 'CANCELLED', eventName: 'RecognitionCancelled' },
      { action: 'CancelRecognitionRecord', from: 'APPROVED', to: 'CANCELLED', eventName: 'RecognitionCancelled' },
      { action: 'RejectRecognitionRecord', from: 'SUBMITTED', to: 'REJECTED', eventName: 'RecognitionRejected' },
      { action: 'RejectRecognitionRecord', from: 'APPROVED', to: 'REJECTED', eventName: 'RecognitionRejected' },
    ],
    initialState: 'SUBMITTED',
    terminalStates: ['AWARDED', 'CANCELLED', 'REJECTED'],
  };
  fsm.register(definition);
}
