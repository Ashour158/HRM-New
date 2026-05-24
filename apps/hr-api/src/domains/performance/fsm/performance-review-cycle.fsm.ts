import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerPerformanceReviewCycleFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'PerformanceReviewCycle',
    states: ['DRAFT', 'SETUP', 'ACTIVE', 'IN_PROGRESS', 'CALIBRATION', 'REVIEW', 'CLOSED', 'CANCELLED'],
    actions: ['CreatePerformanceReviewCycle', 'SetupPerformanceReviewCycle', 'ActivatePerformanceReviewCycle', 'StartPerformanceReviewCycle', 'EnterCalibrationPerformanceReviewCycle', 'EnterReviewPerformanceReviewCycle', 'ClosePerformanceReviewCycle'],
    transitions: [
      { action: 'CreatePerformanceReviewCycle', from: 'DRAFT', to: 'DRAFT', eventName: 'PerformanceReviewCycleCreated' },
      { action: 'SetupPerformanceReviewCycle', from: 'DRAFT', to: 'SETUP', eventName: 'PerformanceReviewCycleSetup' },
      { action: 'ActivatePerformanceReviewCycle', from: 'SETUP', to: 'ACTIVE', eventName: 'PerformanceReviewCycleActivated' },
      { action: 'StartPerformanceReviewCycle', from: 'ACTIVE', to: 'IN_PROGRESS', eventName: 'PerformanceReviewCycleStarted' },
      { action: 'EnterCalibrationPerformanceReviewCycle', from: 'IN_PROGRESS', to: 'CALIBRATION', eventName: 'PerformanceReviewCycleCalibration' },
      { action: 'EnterReviewPerformanceReviewCycle', from: 'CALIBRATION', to: 'REVIEW', eventName: 'PerformanceReviewCycleReview' },
      { action: 'ClosePerformanceReviewCycle', from: 'REVIEW', to: 'CLOSED', eventName: 'PerformanceReviewCycleClosed' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['CLOSED', 'CANCELLED'],
  };
  fsm.register(definition);
}
