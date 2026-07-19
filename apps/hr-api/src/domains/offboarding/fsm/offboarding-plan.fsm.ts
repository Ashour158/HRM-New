import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the OffboardingPlan aggregate.
 *
 * States: DRAFT, ACTIVE, COMPLETED, CANCELLED
 */
@Injectable()
export class OffboardingPlanFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'OffboardingPlan',
      states: ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
      actions: ['StartOffboarding', 'CompleteOffboarding', 'CancelOffboarding'],
      transitions: [
        { action: 'StartOffboarding', from: 'DRAFT', to: 'ACTIVE', eventName: 'OffboardingPlanStarted' },
        { action: 'CompleteOffboarding', from: 'ACTIVE', to: 'COMPLETED', eventName: 'OffboardingPlanCompleted' },
        { action: 'CancelOffboarding', from: 'DRAFT', to: 'CANCELLED', eventName: 'OffboardingPlanCancelled' },
        { action: 'CancelOffboarding', from: 'ACTIVE', to: 'CANCELLED', eventName: 'OffboardingPlanCancelled' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['COMPLETED', 'CANCELLED'],
    });
  }
}
