import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerEmployeeRelationsCaseFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'EmployeeRelationsCase',
    states: ['OPEN', 'UNDER_REVIEW', 'INVESTIGATION', 'DISCIPLINARY', 'RESOLVED', 'CLOSED', 'ESCALATED'],
    actions: ['OpenEmployeeRelationsCase', 'ReviewEmployeeRelationsCase', 'StartInvestigationEmployeeRelationsCase', 'MoveToDisciplinaryEmployeeRelationsCase', 'ResolveEmployeeRelationsCase', 'CloseEmployeeRelationsCase'],
    transitions: [
      { action: 'OpenEmployeeRelationsCase', from: 'OPEN', to: 'OPEN', eventName: 'EmployeeRelationsCaseOpened' },
      { action: 'ReviewEmployeeRelationsCase', from: 'OPEN', to: 'UNDER_REVIEW', eventName: 'EmployeeRelationsCaseReviewed' },
      { action: 'StartInvestigationEmployeeRelationsCase', from: 'OPEN', to: 'INVESTIGATION', eventName: 'EmployeeRelationsCaseInvestigation' },
      { action: 'StartInvestigationEmployeeRelationsCase', from: 'UNDER_REVIEW', to: 'INVESTIGATION', eventName: 'EmployeeRelationsCaseInvestigation' },
      { action: 'MoveToDisciplinaryEmployeeRelationsCase', from: 'INVESTIGATION', to: 'DISCIPLINARY', eventName: 'EmployeeRelationsCaseDisciplinary' },
      { action: 'ResolveEmployeeRelationsCase', from: 'DISCIPLINARY', to: 'RESOLVED', eventName: 'EmployeeRelationsCaseResolved' },
      { action: 'ResolveEmployeeRelationsCase', from: 'INVESTIGATION', to: 'RESOLVED', eventName: 'EmployeeRelationsCaseResolved' },
      { action: 'ResolveEmployeeRelationsCase', from: 'UNDER_REVIEW', to: 'RESOLVED', eventName: 'EmployeeRelationsCaseResolved' },
      { action: 'CloseEmployeeRelationsCase', from: 'RESOLVED', to: 'CLOSED', eventName: 'EmployeeRelationsCaseClosed' },
    ],
    initialState: 'OPEN',
    terminalStates: ['CLOSED', 'ESCALATED'],
  };
  fsm.register(definition);
}
