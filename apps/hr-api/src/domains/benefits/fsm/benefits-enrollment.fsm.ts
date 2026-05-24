import { Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for BenefitsEnrollment lifecycle management.
 *
 * States: DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED → EFFECTIVE → TERMINATED (terminal)
 *                                                              ↘ REJECTED (terminal)
 */
@Injectable()
export class BenefitsEnrollmentFsm {
  constructor(private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'BenefitsEnrollment',
      states: ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'EFFECTIVE', 'TERMINATED', 'REJECTED'],
      actions: ['Submit', 'SendForApproval', 'Approve', 'MakeEffective', 'Terminate', 'Reject'],
      transitions: [
        { action: 'Submit', from: 'DRAFT', to: 'SUBMITTED', eventName: 'BenefitsEnrollmentSubmitted' },
        { action: 'SendForApproval', from: 'SUBMITTED', to: 'PENDING_APPROVAL', eventName: 'BenefitsEnrollmentSubmitted' },
        { action: 'Approve', from: 'PENDING_APPROVAL', to: 'APPROVED', eventName: 'BenefitsEnrollmentApproved' },
        { action: 'MakeEffective', from: 'APPROVED', to: 'EFFECTIVE', eventName: 'BenefitsEnrollmentEffective' },
        { action: 'Terminate', from: 'EFFECTIVE', to: 'TERMINATED', eventName: 'BenefitsEnrollmentTerminated' },
        { action: 'Terminate', from: 'APPROVED', to: 'TERMINATED', eventName: 'BenefitsEnrollmentTerminated' },
        { action: 'Reject', from: 'PENDING_APPROVAL', to: 'REJECTED', eventName: 'BenefitsEnrollmentRejected' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['TERMINATED', 'REJECTED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'BenefitsEnrollment');
  }
}
