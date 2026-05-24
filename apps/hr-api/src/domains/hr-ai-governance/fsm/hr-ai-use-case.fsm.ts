import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class HrAiUseCaseFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'HrAiUseCase',
      states: ['REGISTERED', 'REVIEWED', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'RETIRED', 'REJECTED'],
      actions: ['ReviewHrAiUseCase', 'ApproveHrAiUseCase', 'ActivateHrAiUseCase', 'SuspendHrAiUseCase', 'RetireHrAiUseCase', 'RejectHrAiUseCase'],
      transitions: [
        { action: 'ReviewHrAiUseCase', from: 'REGISTERED', to: 'REVIEWED', eventName: 'HrAiUseCaseReviewed' },
        { action: 'ApproveHrAiUseCase', from: 'REVIEWED', to: 'APPROVED', eventName: 'HrAiUseCaseApproved' },
        { action: 'RejectHrAiUseCase', from: 'REVIEWED', to: 'REJECTED', eventName: 'HrAiUseCaseRejected' },
        { action: 'ActivateHrAiUseCase', from: 'APPROVED', to: 'ACTIVE', eventName: 'HrAiUseCaseActivated' },
        { action: 'SuspendHrAiUseCase', from: 'ACTIVE', to: 'SUSPENDED', eventName: 'HrAiUseCaseSuspended' },
        { action: 'RetireHrAiUseCase', from: 'ACTIVE', to: 'RETIRED', eventName: 'HrAiUseCaseRetired' },
        { action: 'RetireHrAiUseCase', from: 'SUSPENDED', to: 'RETIRED', eventName: 'HrAiUseCaseRetired' },
      ],
      initialState: 'REGISTERED',
      terminalStates: ['RETIRED', 'REJECTED'],
    });
  }
}
