import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class HrAiBiasTestFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'HrAiBiasTest',
      states: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
      actions: ['StartHrAiBiasTest', 'CompleteHrAiBiasTest', 'FailHrAiBiasTest'],
      transitions: [
        { action: 'StartHrAiBiasTest', from: 'PLANNED', to: 'IN_PROGRESS', eventName: 'HrAiBiasTestStarted' },
        { action: 'CompleteHrAiBiasTest', from: 'IN_PROGRESS', to: 'COMPLETED', eventName: 'HrAiBiasTestCompleted' },
        { action: 'FailHrAiBiasTest', from: 'PLANNED', to: 'FAILED', eventName: 'HrAiBiasTestFailed' },
        { action: 'FailHrAiBiasTest', from: 'IN_PROGRESS', to: 'FAILED', eventName: 'HrAiBiasTestFailed' },
      ],
      initialState: 'PLANNED',
      terminalStates: ['COMPLETED', 'FAILED'],
    });
  }
}
