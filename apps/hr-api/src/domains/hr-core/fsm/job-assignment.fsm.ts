import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * Register the JobAssignment finite-state machine with the framework.
 */
export function registerJobAssignmentFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'JobAssignment',
    states: ['DRAFT', 'ACTIVE', 'ENDED'],
    actions: ['CreateJobAssignment', 'ActivateJobAssignment', 'EndJobAssignment', 'UpdateJobAssignment'],
    transitions: [
      { action: 'CreateJobAssignment', from: 'DRAFT', to: 'DRAFT', eventName: 'JobAssignmentCreated' },
      { action: 'ActivateJobAssignment', from: 'DRAFT', to: 'ACTIVE', eventName: 'JobAssignmentActivated' },
      { action: 'EndJobAssignment', from: 'DRAFT', to: 'ENDED', eventName: 'JobAssignmentEnded' },
      { action: 'EndJobAssignment', from: 'ACTIVE', to: 'ENDED', eventName: 'JobAssignmentEnded' },
      { action: 'UpdateJobAssignment', from: 'DRAFT', to: 'DRAFT', eventName: 'JobAssignmentUpdated' },
      { action: 'UpdateJobAssignment', from: 'ACTIVE', to: 'ACTIVE', eventName: 'JobAssignmentUpdated' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ENDED'],
  };

  fsm.register(definition);
}
