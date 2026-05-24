import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerPayrollCycleFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'PayrollCycle',
    states: ['DRAFT', 'OPENED', 'INPUT_COLLECTION', 'VALIDATION', 'CALCULATION', 'REVIEW', 'APPROVED', 'CLOSED', 'EXPORTED', 'CANCELLED'],
    actions: ['CreatePayrollCycle', 'OpenPayrollCycle', 'StartPayrollInputCollection', 'StartPayrollValidation', 'StartPayrollCalculation', 'StartPayrollReview', 'ApprovePayrollCycle', 'ClosePayrollCycle', 'ExportPayrollCycle', 'CancelPayrollCycle'],
    transitions: [
      { action: 'CreatePayrollCycle', from: 'DRAFT', to: 'DRAFT', eventName: 'PayrollCycleCreated' },
      { action: 'OpenPayrollCycle', from: 'DRAFT', to: 'OPENED', eventName: 'PayrollCycleOpened' },
      { action: 'StartPayrollInputCollection', from: 'OPENED', to: 'INPUT_COLLECTION', eventName: 'PayrollCycleInputCollectionStarted' },
      { action: 'StartPayrollValidation', from: 'INPUT_COLLECTION', to: 'VALIDATION', eventName: 'PayrollCycleValidationStarted' },
      { action: 'StartPayrollCalculation', from: 'VALIDATION', to: 'CALCULATION', eventName: 'PayrollCycleCalculationStarted' },
      { action: 'StartPayrollReview', from: 'CALCULATION', to: 'REVIEW', eventName: 'PayrollCycleReviewStarted' },
      { action: 'ApprovePayrollCycle', from: 'REVIEW', to: 'APPROVED', eventName: 'PayrollCycleApproved' },
      { action: 'ClosePayrollCycle', from: 'APPROVED', to: 'CLOSED', eventName: 'PayrollCycleClosed' },
      { action: 'ExportPayrollCycle', from: 'CLOSED', to: 'EXPORTED', eventName: 'PayrollCycleExported' },
      { action: 'CancelPayrollCycle', from: 'DRAFT', to: 'CANCELLED', eventName: 'PayrollCycleCancelled' },
      { action: 'CancelPayrollCycle', from: 'OPENED', to: 'CANCELLED', eventName: 'PayrollCycleCancelled' },
      { action: 'CancelPayrollCycle', from: 'INPUT_COLLECTION', to: 'CANCELLED', eventName: 'PayrollCycleCancelled' },
      { action: 'CancelPayrollCycle', from: 'VALIDATION', to: 'CANCELLED', eventName: 'PayrollCycleCancelled' },
      { action: 'CancelPayrollCycle', from: 'CALCULATION', to: 'CANCELLED', eventName: 'PayrollCycleCancelled' },
      { action: 'CancelPayrollCycle', from: 'REVIEW', to: 'CANCELLED', eventName: 'PayrollCycleCancelled' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['EXPORTED', 'CANCELLED'],
  };
  fsm.register(definition);
}
