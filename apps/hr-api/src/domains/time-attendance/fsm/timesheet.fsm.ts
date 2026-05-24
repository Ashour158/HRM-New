import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerTimesheetFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'Timesheet',
    states: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CORRECTED'],
    actions: ['CreateTimesheet', 'SubmitTimesheet', 'ApproveTimesheet', 'RejectTimesheet', 'CorrectTimesheet'],
    transitions: [
      { action: 'CreateTimesheet', from: 'DRAFT', to: 'DRAFT', eventName: 'TimesheetCreated' },
      { action: 'SubmitTimesheet', from: 'DRAFT', to: 'SUBMITTED', eventName: 'TimesheetSubmitted' },
      { action: 'SubmitTimesheet', from: 'CORRECTED', to: 'SUBMITTED', eventName: 'TimesheetSubmitted' },
      { action: 'ApproveTimesheet', from: 'SUBMITTED', to: 'APPROVED', eventName: 'TimesheetApproved' },
      { action: 'RejectTimesheet', from: 'SUBMITTED', to: 'REJECTED', eventName: 'TimesheetRejected' },
      { action: 'CorrectTimesheet', from: 'REJECTED', to: 'CORRECTED', eventName: 'TimesheetCorrected' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['APPROVED'],
  };
  fsm.register(definition);
}
