import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { registerFeedback360ResponseFsm } from './feedback-360-response.fsm.js';
import { registerPerformanceImprovementPlanFsm } from './performance-improvement-plan.fsm.js';

describe('Performance FSM definitions', () => {
  it('uses canonical command names for 360 feedback response workflow actions', () => {
    const fsm = new FsmFramework();
    registerFeedback360ResponseFsm(fsm);

    const pendingResponse = {
      aggregateId: Uuid.generate(),
      aggregateType: 'PerformanceFeedback360Response',
      currentState: 'PENDING',
      version: 0,
      history: [],
    };

    expect(fsm.getAllowedActions(pendingResponse)).toContain('SubmitPerformanceFeedback360Response');
    expect(fsm.canTransition(pendingResponse, 'SubmitPerformanceFeedback360Response')).toBe(true);
  });

  it('lets extended performance action plans continue to review or termination', () => {
    const fsm = new FsmFramework();
    registerPerformanceImprovementPlanFsm(fsm);

    const extendedPlan = {
      aggregateId: Uuid.generate(),
      aggregateType: 'PerformanceImprovementPlan',
      currentState: 'EXTENDED',
      version: 2,
      history: [],
    };

    expect(fsm.getAllowedActions(extendedPlan)).toEqual(expect.arrayContaining([
      'RecordPerformanceImprovementPlanCheckpoint',
      'EnterReviewPerformanceImprovementPlan',
      'TerminatePerformanceImprovementPlan',
    ]));
    expect(fsm.canTransition(extendedPlan, 'EnterReviewPerformanceImprovementPlan')).toBe(true);
  });
});
