import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerPerformanceImprovementPlanFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'PerformanceImprovementPlan',
    states: ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'REVIEW_PENDING', 'COMPLETED', 'CLOSED', 'EXTENDED', 'TERMINATED'],
    actions: ['CreatePerformanceImprovementPlan', 'ActivatePerformanceImprovementPlan', 'EnterReviewPerformanceImprovementPlan', 'CompletePerformanceImprovementPlan', 'ClosePerformanceImprovementPlan', 'ExtendPerformanceImprovementPlan', 'TerminatePerformanceImprovementPlan'],
    transitions: [
      { action: 'CreatePerformanceImprovementPlan', from: 'DRAFT', to: 'DRAFT', eventName: 'PIPCreated' },
      { action: 'ActivatePerformanceImprovementPlan', from: 'DRAFT', to: 'ACTIVE', eventName: 'PIPActivated' },
      { action: 'EnterReviewPerformanceImprovementPlan', from: 'ACTIVE', to: 'REVIEW_PENDING', eventName: 'PIPReviewPending' },
      { action: 'EnterReviewPerformanceImprovementPlan', from: 'IN_PROGRESS', to: 'REVIEW_PENDING', eventName: 'PIPReviewPending' },
      { action: 'CompletePerformanceImprovementPlan', from: 'REVIEW_PENDING', to: 'COMPLETED', eventName: 'PIPCompleted' },
      { action: 'ClosePerformanceImprovementPlan', from: 'COMPLETED', to: 'CLOSED', eventName: 'PIPClosed' },
      { action: 'ExtendPerformanceImprovementPlan', from: 'ACTIVE', to: 'EXTENDED', eventName: 'PIPExtended' },
      { action: 'ExtendPerformanceImprovementPlan', from: 'IN_PROGRESS', to: 'EXTENDED', eventName: 'PIPExtended' },
      { action: 'ExtendPerformanceImprovementPlan', from: 'REVIEW_PENDING', to: 'EXTENDED', eventName: 'PIPExtended' },
      { action: 'TerminatePerformanceImprovementPlan', from: 'DRAFT', to: 'TERMINATED', eventName: 'PIPTerminated' },
      { action: 'TerminatePerformanceImprovementPlan', from: 'ACTIVE', to: 'TERMINATED', eventName: 'PIPTerminated' },
      { action: 'TerminatePerformanceImprovementPlan', from: 'IN_PROGRESS', to: 'TERMINATED', eventName: 'PIPTerminated' },
      { action: 'TerminatePerformanceImprovementPlan', from: 'REVIEW_PENDING', to: 'TERMINATED', eventName: 'PIPTerminated' },
      { action: 'TerminatePerformanceImprovementPlan', from: 'COMPLETED', to: 'TERMINATED', eventName: 'PIPTerminated' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['CLOSED', 'EXTENDED', 'TERMINATED'],
  };
  fsm.register(definition);
}
