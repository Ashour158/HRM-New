import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class HrAiModelRunFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'HrAiModelRun',
      states: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
      actions: ['StartHrAiModelRun', 'CompleteHrAiModelRun', 'FailHrAiModelRun'],
      transitions: [
        { action: 'StartHrAiModelRun', from: 'PENDING', to: 'RUNNING', eventName: 'HrAiModelRunStarted' },
        { action: 'CompleteHrAiModelRun', from: 'RUNNING', to: 'COMPLETED', eventName: 'HrAiModelRunCompleted' },
        { action: 'FailHrAiModelRun', from: 'PENDING', to: 'FAILED', eventName: 'HrAiModelRunFailed' },
        { action: 'FailHrAiModelRun', from: 'RUNNING', to: 'FAILED', eventName: 'HrAiModelRunFailed' },
      ],
      initialState: 'PENDING',
      terminalStates: ['COMPLETED', 'FAILED'],
    });
  }
}
