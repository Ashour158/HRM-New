import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerAccommodationCaseFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'AccommodationCase',
    states: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'IMPLEMENTED', 'CLOSED', 'REJECTED'],
    actions: ['CreateAccommodationCase', 'ReviewAccommodationCase', 'ApproveAccommodationCase', 'ImplementAccommodationCase', 'CloseAccommodationCase', 'RejectAccommodationCase'],
    transitions: [
      { action: 'CreateAccommodationCase', from: 'REQUESTED', to: 'REQUESTED', eventName: 'AccommodationRequested' },
      { action: 'ReviewAccommodationCase', from: 'REQUESTED', to: 'UNDER_REVIEW', eventName: 'AccommodationUnderReview' },
      { action: 'ApproveAccommodationCase', from: 'REQUESTED', to: 'APPROVED', eventName: 'AccommodationApproved' },
      { action: 'ApproveAccommodationCase', from: 'UNDER_REVIEW', to: 'APPROVED', eventName: 'AccommodationApproved' },
      { action: 'ImplementAccommodationCase', from: 'APPROVED', to: 'IMPLEMENTED', eventName: 'AccommodationImplemented' },
      { action: 'CloseAccommodationCase', from: 'IMPLEMENTED', to: 'CLOSED', eventName: 'AccommodationClosed' },
      { action: 'RejectAccommodationCase', from: 'REQUESTED', to: 'REJECTED', eventName: 'AccommodationRejected' },
      { action: 'RejectAccommodationCase', from: 'UNDER_REVIEW', to: 'REJECTED', eventName: 'AccommodationRejected' },
    ],
    initialState: 'REQUESTED',
    terminalStates: ['CLOSED', 'REJECTED'],
  };
  fsm.register(definition);
}
