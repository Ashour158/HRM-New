import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerDisciplinaryActionFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'DisciplinaryAction',
    states: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTED', 'APPEALED', 'UPHELD', 'REVOKED', 'CANCELLED'],
    actions: ['DraftDisciplinaryAction', 'ApproveDisciplinaryAction', 'ExecuteDisciplinaryAction', 'AppealDisciplinaryAction', 'UpholdDisciplinaryAction', 'RevokeDisciplinaryAction'],
    transitions: [
      { action: 'DraftDisciplinaryAction', from: 'DRAFT', to: 'DRAFT', eventName: 'DisciplinaryActionDrafted' },
      { action: 'ApproveDisciplinaryAction', from: 'DRAFT', to: 'APPROVED', eventName: 'DisciplinaryActionApproved' },
      { action: 'ApproveDisciplinaryAction', from: 'PENDING_APPROVAL', to: 'APPROVED', eventName: 'DisciplinaryActionApproved' },
      { action: 'ExecuteDisciplinaryAction', from: 'APPROVED', to: 'EXECUTED', eventName: 'DisciplinaryActionExecuted' },
      { action: 'AppealDisciplinaryAction', from: 'EXECUTED', to: 'APPEALED', eventName: 'DisciplinaryActionAppealed' },
      { action: 'UpholdDisciplinaryAction', from: 'APPEALED', to: 'UPHELD', eventName: 'DisciplinaryActionUpheld' },
      { action: 'RevokeDisciplinaryAction', from: 'APPEALED', to: 'REVOKED', eventName: 'DisciplinaryActionRevoked' },
      { action: 'RevokeDisciplinaryAction', from: 'EXECUTED', to: 'REVOKED', eventName: 'DisciplinaryActionRevoked' },
      { action: 'RevokeDisciplinaryAction', from: 'APPROVED', to: 'REVOKED', eventName: 'DisciplinaryActionRevoked' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['UPHELD', 'REVOKED', 'CANCELLED'],
  };
  fsm.register(definition);
}
