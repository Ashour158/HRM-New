import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerPerformanceReviewFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'PerformanceReview',
    states: ['DRAFT', 'SELF_REVIEW', 'MANAGER_REVIEW', 'CALIBRATED', 'FINALIZED', 'ACKNOWLEDGED', 'DISPUTED'],
    actions: ['CreatePerformanceReview', 'SubmitSelfReview', 'SubmitManagerReview', 'CalibratePerformanceReview', 'FinalizePerformanceReview', 'AcknowledgePerformanceReview', 'DisputePerformanceReview'],
    transitions: [
      { action: 'CreatePerformanceReview', from: 'DRAFT', to: 'DRAFT', eventName: 'PerformanceReviewDrafted' },
      { action: 'SubmitSelfReview', from: 'DRAFT', to: 'SELF_REVIEW', eventName: 'PerformanceReviewSelfReviewed' },
      { action: 'SubmitManagerReview', from: 'SELF_REVIEW', to: 'MANAGER_REVIEW', eventName: 'PerformanceReviewManagerReviewed' },
      { action: 'CalibratePerformanceReview', from: 'MANAGER_REVIEW', to: 'CALIBRATED', eventName: 'PerformanceReviewCalibrated' },
      { action: 'FinalizePerformanceReview', from: 'CALIBRATED', to: 'FINALIZED', eventName: 'PerformanceReviewFinalized' },
      { action: 'AcknowledgePerformanceReview', from: 'FINALIZED', to: 'ACKNOWLEDGED', eventName: 'PerformanceReviewAcknowledged' },
      { action: 'DisputePerformanceReview', from: 'FINALIZED', to: 'DISPUTED', eventName: 'PerformanceReviewDisputed' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ACKNOWLEDGED', 'DISPUTED'],
  };
  fsm.register(definition);
}
