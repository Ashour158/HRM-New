import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerErInvestigationFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'ErInvestigation',
    states: ['PLANNED', 'IN_PROGRESS', 'EVIDENCE_REVIEW', 'COMPLETED', 'CLOSED'],
    actions: ['CreateErInvestigation', 'StartErInvestigation', 'ReviewEvidenceErInvestigation', 'CompleteErInvestigation'],
    transitions: [
      { action: 'CreateErInvestigation', from: 'PLANNED', to: 'PLANNED', eventName: 'InvestigationPlanned' },
      { action: 'StartErInvestigation', from: 'PLANNED', to: 'IN_PROGRESS', eventName: 'InvestigationStarted' },
      { action: 'ReviewEvidenceErInvestigation', from: 'IN_PROGRESS', to: 'EVIDENCE_REVIEW', eventName: 'InvestigationEvidenceReviewed' },
      { action: 'CompleteErInvestigation', from: 'EVIDENCE_REVIEW', to: 'COMPLETED', eventName: 'InvestigationCompleted' },
      { action: 'CompleteErInvestigation', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'InvestigationCompleted' },
    ],
    initialState: 'PLANNED',
    terminalStates: ['COMPLETED', 'CLOSED'],
  };
  fsm.register(definition);
}
