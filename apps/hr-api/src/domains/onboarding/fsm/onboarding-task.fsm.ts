import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the OnboardingTask aggregate.
 *
 * States: PENDING, IN_PROGRESS, COMPLETED, OVERDUE, SKIPPED
 */
@Injectable()
export class OnboardingTaskFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'OnboardingTask',
      states: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'SKIPPED'],
      actions: ['StartOnboardingTask', 'CompleteOnboardingTask', 'MarkOverdue', 'SkipOnboardingTask'],
      transitions: [
        { action: 'StartOnboardingTask', from: 'PENDING', to: 'IN_PROGRESS', eventName: 'OnboardingTaskStarted' },
        { action: 'CompleteOnboardingTask', from: 'PENDING', to: 'COMPLETED', eventName: 'OnboardingTaskCompleted' },
        { action: 'CompleteOnboardingTask', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'OnboardingTaskCompleted' },
        { action: 'MarkOverdue', from: 'PENDING', to: 'OVERDUE', eventName: 'OnboardingTaskOverdue' },
        { action: 'MarkOverdue', from: 'IN_PROGRESS', to: 'OVERDUE', eventName: 'OnboardingTaskOverdue' },
        { action: 'SkipOnboardingTask', from: 'PENDING', to: 'SKIPPED', eventName: 'OnboardingTaskSkipped' },
        { action: 'SkipOnboardingTask', from: 'IN_PROGRESS', to: 'SKIPPED', eventName: 'OnboardingTaskSkipped' },
        { action: 'SkipOnboardingTask', from: 'OVERDUE', to: 'SKIPPED', eventName: 'OnboardingTaskSkipped' },
      ],
      initialState: 'PENDING',
      terminalStates: ['COMPLETED', 'SKIPPED'],
    });
  }
}
