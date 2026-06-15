import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the WorksCouncilConsultation aggregate.
 *
 * States: REQUIRED, INITIATED, IN_PROGRESS, COMPLETED, BLOCKED
 */
@Injectable()
export class WorksCouncilConsultationFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'WorksCouncilConsultation',
      states: ['REQUIRED', 'INITIATED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'],
      actions: [
        'InitiateWorksCouncilConsultation',
        'StartWorksCouncilProgress',
        'CompleteWorksCouncilConsultation',
        'BlockWorksCouncilAction',
      ],
      transitions: [
        { action: 'InitiateWorksCouncilConsultation', from: 'REQUIRED', to: 'INITIATED', eventName: 'WorksCouncilConsultationInitiated' },
        { action: 'StartWorksCouncilProgress', from: 'INITIATED', to: 'IN_PROGRESS', eventName: 'WorksCouncilConsultationProgressStarted' },
        { action: 'CompleteWorksCouncilConsultation', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'WorksCouncilConsultationCompleted' },
        { action: 'BlockWorksCouncilAction', from: 'INITIATED', to: 'BLOCKED', eventName: 'WorksCouncilActionBlocked' },
        { action: 'BlockWorksCouncilAction', from: 'IN_PROGRESS', to: 'BLOCKED', eventName: 'WorksCouncilActionBlocked' },
      ],
      initialState: 'REQUIRED',
      terminalStates: ['COMPLETED', 'BLOCKED'],
    });
  }
}
