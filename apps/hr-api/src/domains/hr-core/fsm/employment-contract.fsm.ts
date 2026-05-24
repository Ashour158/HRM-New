import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * Register the EmploymentContract finite-state machine with the framework.
 */
export function registerEmploymentContractFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'EmploymentContract',
    states: ['DRAFT', 'OFFERED', 'SIGNED', 'ACTIVE', 'EXPIRED', 'TERMINATED'],
    actions: [
      'CreateEmploymentContract',
      'OfferEmploymentContract',
      'SignEmploymentContract',
      'ActivateEmploymentContract',
      'TerminateEmploymentContract',
      'ExpireEmploymentContract',
    ],
    transitions: [
      { action: 'CreateEmploymentContract', from: 'DRAFT', to: 'DRAFT', eventName: 'EmploymentContractCreated' },
      { action: 'OfferEmploymentContract', from: 'DRAFT', to: 'OFFERED', eventName: 'EmploymentContractOffered' },
      { action: 'SignEmploymentContract', from: 'OFFERED', to: 'SIGNED', eventName: 'EmploymentContractSigned' },
      { action: 'ActivateEmploymentContract', from: 'SIGNED', to: 'ACTIVE', eventName: 'EmploymentContractActivated' },
      { action: 'TerminateEmploymentContract', from: 'DRAFT', to: 'TERMINATED', eventName: 'EmploymentContractTerminated' },
      { action: 'TerminateEmploymentContract', from: 'OFFERED', to: 'TERMINATED', eventName: 'EmploymentContractTerminated' },
      { action: 'TerminateEmploymentContract', from: 'SIGNED', to: 'TERMINATED', eventName: 'EmploymentContractTerminated' },
      { action: 'TerminateEmploymentContract', from: 'ACTIVE', to: 'TERMINATED', eventName: 'EmploymentContractTerminated' },
      { action: 'ExpireEmploymentContract', from: 'ACTIVE', to: 'EXPIRED', eventName: 'EmploymentContractExpired' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['EXPIRED', 'TERMINATED'],
  };

  fsm.register(definition);
}
