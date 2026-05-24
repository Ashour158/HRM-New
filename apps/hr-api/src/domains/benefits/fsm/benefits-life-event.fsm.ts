import { Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for BenefitsLifeEvent lifecycle management.
 *
 * States: RECORDED → PENDING_PROCESSING → PROCESSED
 *                                          ↘ REJECTED (terminal)
 */
@Injectable()
export class BenefitsLifeEventFsm {
  constructor(private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'BenefitsLifeEvent',
      states: ['RECORDED', 'PENDING_PROCESSING', 'PROCESSED', 'REJECTED'],
      actions: ['SendForProcessing', 'Process', 'Reject'],
      transitions: [
        { action: 'SendForProcessing', from: 'RECORDED', to: 'PENDING_PROCESSING', eventName: 'LifeEventPendingProcessing' },
        { action: 'Process', from: 'PENDING_PROCESSING', to: 'PROCESSED', eventName: 'LifeEventProcessed' },
        { action: 'Process', from: 'RECORDED', to: 'PROCESSED', eventName: 'LifeEventProcessed' },
        { action: 'Reject', from: 'PENDING_PROCESSING', to: 'REJECTED', eventName: 'LifeEventRejected' },
        { action: 'Reject', from: 'RECORDED', to: 'REJECTED', eventName: 'LifeEventRejected' },
      ],
      initialState: 'RECORDED',
      terminalStates: ['PROCESSED', 'REJECTED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'BenefitsLifeEvent');
  }
}
