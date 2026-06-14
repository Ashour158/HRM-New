import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the Candidate aggregate.
 *
 * States: NEW, SCREENING, INTERVIEWING, OFFER_PENDING, HIRED, REJECTED, WITHDRAWN
 */
@Injectable()
export class CandidateFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'Candidate',
      states: ['NEW', 'SCREENING', 'INTERVIEWING', 'OFFER_PENDING', 'HIRED', 'REJECTED', 'WITHDRAWN'],
      actions: [
        'ScreenCandidate',
        'ScheduleInterview',
        'MakeOfferPending',
        'HireCandidate',
        'RejectCandidate',
        'WithdrawCandidate',
        'UpdateCandidate',
      ],
      transitions: [
        { action: 'ScreenCandidate', from: 'NEW', to: 'SCREENING', eventName: 'CandidateScreened' },
        { action: 'ScheduleInterview', from: 'SCREENING', to: 'INTERVIEWING', eventName: 'CandidateInterviewScheduled' },
        { action: 'MakeOfferPending', from: 'INTERVIEWING', to: 'OFFER_PENDING', eventName: 'CandidateOfferPending' },
        { action: 'HireCandidate', from: 'OFFER_PENDING', to: 'HIRED', eventName: 'CandidateHired' },
        { action: 'RejectCandidate', from: 'NEW', to: 'REJECTED', eventName: 'CandidateRejected' },
        { action: 'RejectCandidate', from: 'SCREENING', to: 'REJECTED', eventName: 'CandidateRejected' },
        { action: 'RejectCandidate', from: 'INTERVIEWING', to: 'REJECTED', eventName: 'CandidateRejected' },
        { action: 'RejectCandidate', from: 'OFFER_PENDING', to: 'REJECTED', eventName: 'CandidateRejected' },
        { action: 'WithdrawCandidate', from: 'NEW', to: 'WITHDRAWN', eventName: 'CandidateWithdrew' },
        { action: 'WithdrawCandidate', from: 'SCREENING', to: 'WITHDRAWN', eventName: 'CandidateWithdrew' },
        { action: 'WithdrawCandidate', from: 'INTERVIEWING', to: 'WITHDRAWN', eventName: 'CandidateWithdrew' },
        { action: 'WithdrawCandidate', from: 'OFFER_PENDING', to: 'WITHDRAWN', eventName: 'CandidateWithdrew' },
        { action: 'UpdateCandidate', from: 'NEW', to: 'NEW', eventName: 'CandidateUpdated' },
        { action: 'UpdateCandidate', from: 'SCREENING', to: 'SCREENING', eventName: 'CandidateUpdated' },
        { action: 'UpdateCandidate', from: 'INTERVIEWING', to: 'INTERVIEWING', eventName: 'CandidateUpdated' },
        { action: 'UpdateCandidate', from: 'OFFER_PENDING', to: 'OFFER_PENDING', eventName: 'CandidateUpdated' },
      ],
      initialState: 'NEW',
      terminalStates: ['HIRED', 'REJECTED', 'WITHDRAWN'],
    });
  }
}
