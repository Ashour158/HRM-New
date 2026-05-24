import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerPayrollResultLineFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'PayrollResultLine',
    states: ['CALCULATED', 'EXPLAINED', 'REVIEWED', 'LOCKED'],
    actions: ['CalculatePayrollResultLine', 'ExplainPayrollResultLine', 'ReviewPayrollResultLine', 'LockPayrollResultLine'],
    transitions: [
      { action: 'CalculatePayrollResultLine', from: 'CALCULATED', to: 'CALCULATED', eventName: 'PayrollResultLineCalculated' },
      { action: 'ExplainPayrollResultLine', from: 'CALCULATED', to: 'EXPLAINED', eventName: 'PayrollResultLineExplained' },
      { action: 'ReviewPayrollResultLine', from: 'EXPLAINED', to: 'REVIEWED', eventName: 'PayrollResultLineReviewed' },
      { action: 'LockPayrollResultLine', from: 'REVIEWED', to: 'LOCKED', eventName: 'PayrollResultLineLocked' },
    ],
    initialState: 'CALCULATED',
    terminalStates: ['LOCKED'],
  };
  fsm.register(definition);
}
