import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerCollectiveBargainingSessionFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'CollectiveBargainingSession',
    states: ['SCHEDULED', 'IN_PROGRESS', 'TENTATIVE_AGREEMENT', 'RATIFIED', 'FAILED', 'CLOSED'],
    actions: ['CreateCollectiveBargainingSession', 'StartCollectiveBargainingSession', 'RecordTentativeAgreementCollectiveBargainingSession', 'RatifyCollectiveBargainingSession', 'MarkFailedCollectiveBargainingSession', 'CloseCollectiveBargainingSession'],
    transitions: [
      { action: 'CreateCollectiveBargainingSession', from: '', to: 'SCHEDULED', eventName: 'CollectiveBargainingSessionCreated' },
      { action: 'StartCollectiveBargainingSession', from: 'SCHEDULED', to: 'IN_PROGRESS', eventName: 'CollectiveBargainingSessionInProgress' },
      { action: 'RecordTentativeAgreementCollectiveBargainingSession', from: 'IN_PROGRESS', to: 'TENTATIVE_AGREEMENT', eventName: 'CollectiveBargainingSessionTentativeAgreement' },
      { action: 'RatifyCollectiveBargainingSession', from: 'TENTATIVE_AGREEMENT', to: 'RATIFIED', eventName: 'CollectiveBargainingSessionRatified' },
      { action: 'MarkFailedCollectiveBargainingSession', from: 'IN_PROGRESS', to: 'FAILED', eventName: 'CollectiveBargainingSessionFailed' },
      { action: 'CloseCollectiveBargainingSession', from: 'RATIFIED', to: 'CLOSED', eventName: 'CollectiveBargainingSessionClosed' },
      { action: 'CloseCollectiveBargainingSession', from: 'FAILED', to: 'CLOSED', eventName: 'CollectiveBargainingSessionClosed' },
    ],
    initialState: 'SCHEDULED',
    terminalStates: ['CLOSED'],
  };
  fsm.register(definition);
}
