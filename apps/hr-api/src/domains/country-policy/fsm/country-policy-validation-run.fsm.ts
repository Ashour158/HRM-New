import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the CountryPolicyValidationRun aggregate.
 *
 * States: PENDING, IN_PROGRESS, COMPLETED, FAILED
 */
@Injectable()
export class CountryPolicyValidationRunFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'CountryPolicyValidationRun',
      states: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
      actions: ['StartValidationRun', 'CompleteValidationRun', 'FailValidationRun'],
      transitions: [
        { action: 'StartValidationRun', from: 'PENDING', to: 'IN_PROGRESS', eventName: 'ValidationRunStarted' },
        { action: 'CompleteValidationRun', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'ValidationRunCompleted' },
        { action: 'FailValidationRun', from: 'IN_PROGRESS', to: 'FAILED', eventName: 'ValidationRunFailed' },
      ],
      initialState: 'PENDING',
      terminalStates: ['COMPLETED', 'FAILED'],
    });
  }
}
