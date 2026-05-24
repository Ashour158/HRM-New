import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerContingentWorkerAssignmentFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'ContingentWorkerAssignment',
    states: ['DRAFT', 'ACTIVE', 'EXTENDED', 'TERMINATED'],
    actions: ['CreateContingentWorkerAssignment', 'ActivateContingentWorkerAssignment', 'ExtendContingentWorkerAssignment', 'TerminateContingentWorkerAssignment'],
    transitions: [
      { action: 'CreateContingentWorkerAssignment', from: 'DRAFT', to: 'DRAFT', eventName: 'ContingentAssignmentCreated' },
      { action: 'ActivateContingentWorkerAssignment', from: 'DRAFT', to: 'ACTIVE', eventName: 'ContingentAssignmentActivated' },
      { action: 'ExtendContingentWorkerAssignment', from: 'ACTIVE', to: 'EXTENDED', eventName: 'ContingentAssignmentExtended' },
      { action: 'TerminateContingentWorkerAssignment', from: 'ACTIVE', to: 'TERMINATED', eventName: 'ContingentAssignmentTerminated' },
      { action: 'TerminateContingentWorkerAssignment', from: 'EXTENDED', to: 'TERMINATED', eventName: 'ContingentAssignmentTerminated' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['TERMINATED'],
  };
  fsm.register(definition);
}
