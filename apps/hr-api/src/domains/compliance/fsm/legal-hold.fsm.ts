import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the LegalHold aggregate.
 *
 * States: ACTIVE, RELEASED
 */
@Injectable()
export class LegalHoldFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'LegalHold',
      states: ['ACTIVE', 'RELEASED'],
      actions: ['ReleaseLegalHold'],
      transitions: [
        { action: 'ReleaseLegalHold', from: 'ACTIVE', to: 'RELEASED', eventName: 'LegalHoldReleased' },
      ],
      initialState: 'ACTIVE',
      terminalStates: ['RELEASED'],
    });
  }
}
