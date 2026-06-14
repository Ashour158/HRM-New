import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the InterviewPlan aggregate.
 *
 * States: DRAFT, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
 */
@Injectable()
export class InterviewPlanFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'InterviewPlan',
      states: ['DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      actions: ['ScheduleInterview', 'StartInterview', 'CompleteInterview', 'CancelInterview'],
      transitions: [
        { action: 'ScheduleInterview', from: 'DRAFT', to: 'SCHEDULED', eventName: 'InterviewPlanScheduled' },
        { action: 'StartInterview', from: 'SCHEDULED', to: 'IN_PROGRESS', eventName: 'InterviewPlanStarted' },
        { action: 'CompleteInterview', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'InterviewPlanCompleted' },
        { action: 'CancelInterview', from: 'DRAFT', to: 'CANCELLED', eventName: 'InterviewPlanCancelled' },
        { action: 'CancelInterview', from: 'SCHEDULED', to: 'CANCELLED', eventName: 'InterviewPlanCancelled' },
        { action: 'CancelInterview', from: 'IN_PROGRESS', to: 'CANCELLED', eventName: 'InterviewPlanCancelled' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['COMPLETED', 'CANCELLED'],
    });
  }
}
