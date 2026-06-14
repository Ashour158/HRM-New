import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the StatutoryLeaveType aggregate.
 *
 * States: ACTIVE, SUPERSEDED
 */
@Injectable()
export class StatutoryLeaveTypeFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'StatutoryLeaveType',
      states: ['ACTIVE', 'SUPERSEDED'],
      actions: ['UpdateStatutoryLeaveType', 'SupersedeStatutoryLeaveType'],
      transitions: [
        { action: 'UpdateStatutoryLeaveType', from: 'ACTIVE', to: 'ACTIVE', eventName: 'StatutoryLeaveTypeUpdated' },
        { action: 'SupersedeStatutoryLeaveType', from: 'ACTIVE', to: 'SUPERSEDED', eventName: 'StatutoryLeaveTypeSuperseded' },
      ],
      initialState: 'ACTIVE',
      terminalStates: ['SUPERSEDED'],
    });
  }
}
