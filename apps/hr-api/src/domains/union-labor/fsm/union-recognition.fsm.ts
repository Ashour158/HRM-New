import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerUnionRecognitionFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'UnionRecognition',
    states: ['RECOGNIZED', 'NEGOTIATING', 'RATIFIED', 'ACTIVE', 'EXPIRED', 'RENEWED'],
    actions: ['CreateUnionRecognition', 'NegotiateUnionRecognition', 'RatifyUnionRecognition', 'ActivateUnionRecognition', 'ExpireUnionRecognition', 'RenewUnionRecognition'],
    transitions: [
      { action: 'CreateUnionRecognition', from: '', to: 'RECOGNIZED', eventName: 'UnionRecognitionCreated' },
      { action: 'NegotiateUnionRecognition', from: 'RECOGNIZED', to: 'NEGOTIATING', eventName: 'UnionRecognitionNegotiating' },
      { action: 'RatifyUnionRecognition', from: 'NEGOTIATING', to: 'RATIFIED', eventName: 'UnionRecognitionRatified' },
      { action: 'ActivateUnionRecognition', from: 'RATIFIED', to: 'ACTIVE', eventName: 'UnionRecognitionActive' },
      { action: 'ExpireUnionRecognition', from: 'ACTIVE', to: 'EXPIRED', eventName: 'UnionRecognitionExpired' },
      { action: 'ExpireUnionRecognition', from: 'RATIFIED', to: 'EXPIRED', eventName: 'UnionRecognitionExpired' },
      { action: 'RenewUnionRecognition', from: 'EXPIRED', to: 'RENEWED', eventName: 'UnionRecognitionRenewed' },
    ],
    initialState: 'RECOGNIZED',
    terminalStates: ['RENEWED'],
  };
  fsm.register(definition);
}
