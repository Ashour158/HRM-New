import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerGrievanceFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'Grievance',
    states: ['FILED', 'ACKNOWLEDGED', 'UNDER_INVESTIGATION', 'RESOLVED', 'ARBITRATED', 'WITHDRAWN'],
    actions: ['CreateGrievance', 'AcknowledgeGrievance', 'StartInvestigationGrievance', 'ResolveGrievance', 'ArbitrateGrievance', 'WithdrawGrievance'],
    transitions: [
      { action: 'CreateGrievance', from: '', to: 'FILED', eventName: 'GrievanceFiled' },
      { action: 'AcknowledgeGrievance', from: 'FILED', to: 'ACKNOWLEDGED', eventName: 'GrievanceAcknowledged' },
      { action: 'StartInvestigationGrievance', from: 'ACKNOWLEDGED', to: 'UNDER_INVESTIGATION', eventName: 'GrievanceUnderInvestigation' },
      { action: 'ResolveGrievance', from: 'UNDER_INVESTIGATION', to: 'RESOLVED', eventName: 'GrievanceResolved' },
      { action: 'ArbitrateGrievance', from: 'UNDER_INVESTIGATION', to: 'ARBITRATED', eventName: 'GrievanceArbitrated' },
      { action: 'WithdrawGrievance', from: 'FILED', to: 'WITHDRAWN', eventName: 'GrievanceWithdrawn' },
      { action: 'WithdrawGrievance', from: 'ACKNOWLEDGED', to: 'WITHDRAWN', eventName: 'GrievanceWithdrawn' },
      { action: 'WithdrawGrievance', from: 'UNDER_INVESTIGATION', to: 'WITHDRAWN', eventName: 'GrievanceWithdrawn' },
    ],
    initialState: 'FILED',
    terminalStates: ['RESOLVED', 'ARBITRATED', 'WITHDRAWN'],
  };
  fsm.register(definition);
}
