import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the CountryPolicyImpactSimulation aggregate.
 *
 * States: PENDING, IN_PROGRESS, COMPLETED, FAILED
 */
@Injectable()
export class CountryPolicyImpactSimulationFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'CountryPolicyImpactSimulation',
      states: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
      actions: ['StartImpactSimulation', 'CompleteImpactSimulation', 'FailImpactSimulation'],
      transitions: [
        { action: 'StartImpactSimulation', from: 'PENDING', to: 'IN_PROGRESS', eventName: 'ImpactSimulationStarted' },
        { action: 'CompleteImpactSimulation', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'ImpactSimulationCompleted' },
        { action: 'FailImpactSimulation', from: 'IN_PROGRESS', to: 'FAILED', eventName: 'ImpactSimulationFailed' },
      ],
      initialState: 'PENDING',
      terminalStates: ['COMPLETED', 'FAILED'],
    });
  }
}
