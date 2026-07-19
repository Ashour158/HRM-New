import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the I9Case aggregate.
 *
 * States: DRAFT, SECTION1_COMPLETED, SECTION2_VERIFIED, REJECTED,
 *         EVERIFY_SUBMITTED, EVERIFY_CONFIRMED, EVERIFY_TNC,
 *         EVERIFY_TNC_CONTESTED, EVERIFY_FINAL_NONCONFIRMATION
 *
 * This registration documents the transition table for introspection
 * (`getAllowedActionsFromState`); like every other domain in this codebase, the
 * actual guard logic is hand-rolled on the aggregate itself rather than invoked
 * through `FsmFramework.transition()`.
 */
@Injectable()
export class I9CaseFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'I9Case',
      states: [
        'DRAFT',
        'SECTION1_COMPLETED',
        'SECTION2_VERIFIED',
        'REJECTED',
        'EVERIFY_SUBMITTED',
        'EVERIFY_CONFIRMED',
        'EVERIFY_TNC',
        'EVERIFY_TNC_CONTESTED',
        'EVERIFY_FINAL_NONCONFIRMATION',
      ],
      actions: [
        'CompleteI9CaseSection1',
        'CompleteI9CaseSection2',
        'RejectI9Case',
        'SubmitEverifyCase',
        'RecordEverifyResult',
        'ContestEverifyTentativeNonconfirmation',
      ],
      transitions: [
        { action: 'CompleteI9CaseSection1', from: 'DRAFT', to: 'SECTION1_COMPLETED', eventName: 'I9CaseSection1Completed' },
        { action: 'CompleteI9CaseSection2', from: 'SECTION1_COMPLETED', to: 'SECTION2_VERIFIED', eventName: 'I9CaseSection2Completed' },
        { action: 'RejectI9Case', from: 'SECTION2_VERIFIED', to: 'REJECTED', eventName: 'I9CaseRejected' },
        { action: 'SubmitEverifyCase', from: 'SECTION2_VERIFIED', to: 'EVERIFY_SUBMITTED', eventName: 'I9CaseEverifySubmitted' },
        { action: 'RecordEverifyResult', from: 'EVERIFY_SUBMITTED', to: 'EVERIFY_CONFIRMED', eventName: 'I9CaseEverifyResultRecorded' },
        { action: 'RecordEverifyResult', from: 'EVERIFY_SUBMITTED', to: 'EVERIFY_TNC', eventName: 'I9CaseEverifyResultRecorded' },
        { action: 'RecordEverifyResult', from: 'EVERIFY_TNC', to: 'EVERIFY_FINAL_NONCONFIRMATION', eventName: 'I9CaseEverifyResultRecorded' },
        { action: 'RecordEverifyResult', from: 'EVERIFY_TNC_CONTESTED', to: 'EVERIFY_CONFIRMED', eventName: 'I9CaseEverifyResultRecorded' },
        { action: 'RecordEverifyResult', from: 'EVERIFY_TNC_CONTESTED', to: 'EVERIFY_FINAL_NONCONFIRMATION', eventName: 'I9CaseEverifyResultRecorded' },
        { action: 'ContestEverifyTentativeNonconfirmation', from: 'EVERIFY_TNC', to: 'EVERIFY_TNC_CONTESTED', eventName: 'I9CaseEverifyTncContested' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['REJECTED', 'EVERIFY_CONFIRMED', 'EVERIFY_FINAL_NONCONFIRMATION'],
    });
  }
}
