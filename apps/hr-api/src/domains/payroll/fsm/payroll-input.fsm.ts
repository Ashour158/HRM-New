import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerPayrollInputFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'PayrollInput',
    states: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CORRECTED'],
    actions: ['CreatePayrollInput', 'SubmitPayrollInput', 'ApprovePayrollInput', 'RejectPayrollInput', 'CorrectPayrollInput'],
    transitions: [
      { action: 'CreatePayrollInput', from: 'DRAFT', to: 'DRAFT', eventName: 'PayrollInputCreated' },
      { action: 'SubmitPayrollInput', from: 'DRAFT', to: 'SUBMITTED', eventName: 'PayrollInputSubmitted' },
      { action: 'SubmitPayrollInput', from: 'CORRECTED', to: 'SUBMITTED', eventName: 'PayrollInputSubmitted' },
      { action: 'ApprovePayrollInput', from: 'SUBMITTED', to: 'APPROVED', eventName: 'PayrollInputApproved' },
      { action: 'RejectPayrollInput', from: 'SUBMITTED', to: 'REJECTED', eventName: 'PayrollInputRejected' },
      { action: 'CorrectPayrollInput', from: 'REJECTED', to: 'CORRECTED', eventName: 'PayrollInputCorrected' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['APPROVED'],
  };
  fsm.register(definition);
}
