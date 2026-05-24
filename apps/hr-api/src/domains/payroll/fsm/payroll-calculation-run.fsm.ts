import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerPayrollCalculationRunFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'PayrollCalculationRun',
    states: ['PENDING', 'IN_PROGRESS', 'VALIDATED', 'FINALIZED', 'FAILED'],
    actions: ['StartPayrollCalculationRun', 'ValidatePayrollCalculationRun', 'FinalizePayrollCalculationRun', 'FailPayrollCalculationRun'],
    transitions: [
      { action: 'StartPayrollCalculationRun', from: 'PENDING', to: 'PENDING', eventName: 'PayrollCalculationStarted' },
      { action: 'ValidatePayrollCalculationRun', from: 'PENDING', to: 'VALIDATED', eventName: 'PayrollCalculationValidated' },
      { action: 'ValidatePayrollCalculationRun', from: 'IN_PROGRESS', to: 'VALIDATED', eventName: 'PayrollCalculationValidated' },
      { action: 'FinalizePayrollCalculationRun', from: 'VALIDATED', to: 'FINALIZED', eventName: 'PayrollCalculationFinalized' },
      { action: 'FailPayrollCalculationRun', from: 'PENDING', to: 'FAILED', eventName: 'PayrollCalculationFailed' },
      { action: 'FailPayrollCalculationRun', from: 'IN_PROGRESS', to: 'FAILED', eventName: 'PayrollCalculationFailed' },
    ],
    initialState: 'PENDING',
    terminalStates: ['FINALIZED', 'FAILED'],
  };
  fsm.register(definition);
}
