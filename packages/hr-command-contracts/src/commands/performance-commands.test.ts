import { describe, expect, it } from 'vitest';
import { PerformanceCommandNames } from './performance-commands.js';

describe('performance command contracts', () => {
  it('exports every live performance command name used by the API/FSM layer', () => {
    expect(PerformanceCommandNames).toEqual(expect.arrayContaining([
      'SetupPerformanceReviewCycle',
      'ActivatePerformanceReviewCycle',
      'StartPerformanceReviewCycle',
      'EnterCalibrationPerformanceReviewCycle',
      'EnterReviewPerformanceReviewCycle',
      'ClosePerformanceReviewCycle',
      'CreatePerformanceReview',
      'SubmitSelfReview',
      'SubmitManagerReview',
      'CalibratePerformanceReview',
      'FinalizePerformanceReview',
      'DisputePerformanceReview',
      'CreatePerformanceFeedback360Cycle',
      'LaunchPerformanceFeedback360Cycle',
      'CreatePerformanceFeedback360Response',
      'SubmitPerformanceFeedback360Response',
      'CreateObjective',
      'CreateKeyResult',
      'CreateKpi',
      'RecordKpiMeasurement',
      'CreateReviewTemplate',
      'CreateDevelopmentPlan',
    ]));
  });
});
