import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * Register the EmploymentRelationship finite-state machine with the framework.
 */
export function registerEmploymentRelationshipFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'EmploymentRelationship',
    states: ['DRAFT', 'ACTIVE', 'PROBATION', 'CONFIRMED', 'ENDED'],
    actions: [
      'CreateEmploymentRelationship',
      'ActivateEmploymentRelationship',
      'StartProbation',
      'ConfirmEmployment',
      'EndEmploymentRelationship',
    ],
    transitions: [
      { action: 'CreateEmploymentRelationship', from: 'DRAFT', to: 'DRAFT', eventName: 'EmploymentRelationshipCreated' },
      { action: 'ActivateEmploymentRelationship', from: 'DRAFT', to: 'ACTIVE', eventName: 'EmploymentRelationshipActivated' },
      { action: 'StartProbation', from: 'ACTIVE', to: 'PROBATION', eventName: 'ProbationStarted' },
      { action: 'ConfirmEmployment', from: 'PROBATION', to: 'CONFIRMED', eventName: 'EmploymentConfirmed' },
      { action: 'EndEmploymentRelationship', from: 'DRAFT', to: 'ENDED', eventName: 'EmploymentRelationshipEnded' },
      { action: 'EndEmploymentRelationship', from: 'ACTIVE', to: 'ENDED', eventName: 'EmploymentRelationshipEnded' },
      { action: 'EndEmploymentRelationship', from: 'PROBATION', to: 'ENDED', eventName: 'EmploymentRelationshipEnded' },
      { action: 'EndEmploymentRelationship', from: 'CONFIRMED', to: 'ENDED', eventName: 'EmploymentRelationshipEnded' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ENDED'],
  };

  fsm.register(definition);
}
