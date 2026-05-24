import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the OnboardingPlan aggregate.
 *
 * States: DRAFT, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
 */
@Injectable()
export class OnboardingPlanFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'OnboardingPlan',
      states: ['DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      actions: ['ScheduleOnboarding', 'StartOnboarding', 'CompleteOnboarding', 'CancelOnboarding'],
      transitions: [
        { action: 'ScheduleOnboarding', from: 'DRAFT', to: 'SCHEDULED', eventName: 'OnboardingPlanScheduled' },
        { action: 'StartOnboarding', from: 'SCHEDULED', to: 'IN_PROGRESS', eventName: 'OnboardingPlanStarted' },
        { action: 'CompleteOnboarding', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'OnboardingPlanCompleted' },
        { action: 'CancelOnboarding', from: 'DRAFT', to: 'CANCELLED', eventName: 'OnboardingPlanCancelled' },
        { action: 'CancelOnboarding', from: 'SCHEDULED', to: 'CANCELLED', eventName: 'OnboardingPlanCancelled' },
        { action: 'CancelOnboarding', from: 'IN_PROGRESS', to: 'CANCELLED', eventName: 'OnboardingPlanCancelled' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['COMPLETED', 'CANCELLED'],
    });
  }
}
