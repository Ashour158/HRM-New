import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerMisclassificationAssessmentFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'MisclassificationAssessment',
    states: ['PENDING', 'IN_PROGRESS', 'REVIEW_REQUIRED', 'CLEARED', 'FLAGGED'],
    actions: ['CreateMisclassificationAssessment', 'StartMisclassificationAssessment', 'MarkReviewRequiredMisclassificationAssessment', 'ClearMisclassificationAssessment', 'FlagMisclassificationAssessment'],
    transitions: [
      { action: 'CreateMisclassificationAssessment', from: 'PENDING', to: 'PENDING', eventName: 'MisclassificationAssessmentStarted' },
      { action: 'StartMisclassificationAssessment', from: 'PENDING', to: 'IN_PROGRESS', eventName: 'MisclassificationAssessmentStarted' },
      { action: 'MarkReviewRequiredMisclassificationAssessment', from: 'IN_PROGRESS', to: 'REVIEW_REQUIRED', eventName: 'MisclassificationReviewRequired' },
      { action: 'ClearMisclassificationAssessment', from: 'IN_PROGRESS', to: 'CLEARED', eventName: 'MisclassificationCleared' },
      { action: 'ClearMisclassificationAssessment', from: 'REVIEW_REQUIRED', to: 'CLEARED', eventName: 'MisclassificationCleared' },
      { action: 'FlagMisclassificationAssessment', from: 'IN_PROGRESS', to: 'FLAGGED', eventName: 'MisclassificationFlagged' },
      { action: 'FlagMisclassificationAssessment', from: 'REVIEW_REQUIRED', to: 'FLAGGED', eventName: 'MisclassificationFlagged' },
    ],
    initialState: 'PENDING',
    terminalStates: ['CLEARED', 'FLAGGED'],
  };
  fsm.register(definition);
}
