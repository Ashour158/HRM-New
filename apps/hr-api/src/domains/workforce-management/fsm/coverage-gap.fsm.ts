import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerCoverageGapFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'CoverageGap',
    states: ['DETECTED', 'NOTIFIED', 'FILLED', 'CLOSED'],
    actions: ['CreateCoverageGap', 'NotifyCoverageGap', 'FillCoverageGap', 'CloseCoverageGap'],
    transitions: [
      { action: 'CreateCoverageGap', from: 'DETECTED', to: 'DETECTED', eventName: 'CoverageGapDetected' },
      { action: 'NotifyCoverageGap', from: 'DETECTED', to: 'NOTIFIED', eventName: 'CoverageGapNotified' },
      { action: 'FillCoverageGap', from: 'DETECTED', to: 'FILLED', eventName: 'CoverageGapFilled' },
      { action: 'FillCoverageGap', from: 'NOTIFIED', to: 'FILLED', eventName: 'CoverageGapFilled' },
      { action: 'CloseCoverageGap', from: 'DETECTED', to: 'CLOSED', eventName: 'CoverageGapClosed' },
      { action: 'CloseCoverageGap', from: 'NOTIFIED', to: 'CLOSED', eventName: 'CoverageGapClosed' },
      { action: 'CloseCoverageGap', from: 'FILLED', to: 'CLOSED', eventName: 'CoverageGapClosed' },
    ],
    initialState: 'DETECTED',
    terminalStates: ['CLOSED'],
  };
  fsm.register(definition);
}
