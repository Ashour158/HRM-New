import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the OffboardingTask aggregate.
 *
 * States: PENDING, IN_PROGRESS, COMPLETED, OVERDUE, SKIPPED
 */
@Injectable()
export class OffboardingTaskFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'OffboardingTask',
      states: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'SKIPPED'],
      actions: ['StartOffboardingTask', 'CompleteOffboardingTask', 'MarkOverdue', 'SkipOffboardingTask'],
      transitions: [
        { action: 'StartOffboardingTask', from: 'PENDING', to: 'IN_PROGRESS', eventName: 'OffboardingTaskStarted' },
        { action: 'CompleteOffboardingTask', from: 'PENDING', to: 'COMPLETED', eventName: 'OffboardingTaskCompleted' },
        { action: 'CompleteOffboardingTask', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'OffboardingTaskCompleted' },
        { action: 'MarkOverdue', from: 'PENDING', to: 'OVERDUE', eventName: 'OffboardingTaskOverdue' },
        { action: 'MarkOverdue', from: 'IN_PROGRESS', to: 'OVERDUE', eventName: 'OffboardingTaskOverdue' },
        { action: 'SkipOffboardingTask', from: 'PENDING', to: 'SKIPPED', eventName: 'OffboardingTaskSkipped' },
        { action: 'SkipOffboardingTask', from: 'IN_PROGRESS', to: 'SKIPPED', eventName: 'OffboardingTaskSkipped' },
        { action: 'SkipOffboardingTask', from: 'OVERDUE', to: 'SKIPPED', eventName: 'OffboardingTaskSkipped' },
      ],
      initialState: 'PENDING',
      terminalStates: ['COMPLETED', 'SKIPPED'],
    });
  }
}
