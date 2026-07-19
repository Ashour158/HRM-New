import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the EverifyCase aggregate.
 *
 * States: DRAFT, SUBMITTED, CONFIRMED, TENTATIVE_NONCONFIRMATION, CONTESTED,
 *         FINAL_NONCONFIRMATION
 */
@Injectable()
export class EverifyCaseFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'EverifyCase',
      states: ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'TENTATIVE_NONCONFIRMATION', 'CONTESTED', 'FINAL_NONCONFIRMATION'],
      actions: ['SubmitEverifyCase', 'RecordEverifyResult', 'ContestEverifyTentativeNonconfirmation'],
      transitions: [
        { action: 'SubmitEverifyCase', from: 'DRAFT', to: 'SUBMITTED', eventName: 'EverifyCaseSubmitted' },
        { action: 'RecordEverifyResult', from: 'SUBMITTED', to: 'CONFIRMED', eventName: 'EverifyCaseResultRecorded' },
        { action: 'RecordEverifyResult', from: 'SUBMITTED', to: 'TENTATIVE_NONCONFIRMATION', eventName: 'EverifyCaseResultRecorded' },
        { action: 'RecordEverifyResult', from: 'TENTATIVE_NONCONFIRMATION', to: 'FINAL_NONCONFIRMATION', eventName: 'EverifyCaseResultRecorded' },
        { action: 'RecordEverifyResult', from: 'CONTESTED', to: 'CONFIRMED', eventName: 'EverifyCaseResultRecorded' },
        { action: 'RecordEverifyResult', from: 'CONTESTED', to: 'FINAL_NONCONFIRMATION', eventName: 'EverifyCaseResultRecorded' },
        { action: 'ContestEverifyTentativeNonconfirmation', from: 'TENTATIVE_NONCONFIRMATION', to: 'CONTESTED', eventName: 'EverifyCaseContested' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['CONFIRMED', 'FINAL_NONCONFIRMATION'],
    });
  }
}
