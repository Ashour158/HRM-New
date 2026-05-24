import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerTalentPoolFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'TalentPool',
    states: ['ACTIVE', 'UNDER_REVIEW', 'CLOSED'],
    actions: ['CreateTalentPool', 'UpdateTalentPool', 'AddTalentPoolMember', 'RemoveTalentPoolMember', 'CloseTalentPool'],
    transitions: [
      { action: 'CreateTalentPool', from: 'ACTIVE', to: 'ACTIVE', eventName: 'TalentPoolCreated' },
      { action: 'UpdateTalentPool', from: 'ACTIVE', to: 'UNDER_REVIEW', eventName: 'TalentPoolUpdated' },
      { action: 'UpdateTalentPool', from: 'UNDER_REVIEW', to: 'UNDER_REVIEW', eventName: 'TalentPoolUpdated' },
      { action: 'AddTalentPoolMember', from: 'ACTIVE', to: 'ACTIVE', eventName: 'TalentPoolMemberAdded' },
      { action: 'AddTalentPoolMember', from: 'UNDER_REVIEW', to: 'UNDER_REVIEW', eventName: 'TalentPoolMemberAdded' },
      { action: 'RemoveTalentPoolMember', from: 'ACTIVE', to: 'ACTIVE', eventName: 'TalentPoolMemberRemoved' },
      { action: 'RemoveTalentPoolMember', from: 'UNDER_REVIEW', to: 'UNDER_REVIEW', eventName: 'TalentPoolMemberRemoved' },
      { action: 'CloseTalentPool', from: 'ACTIVE', to: 'CLOSED', eventName: 'TalentPoolClosed' },
      { action: 'CloseTalentPool', from: 'UNDER_REVIEW', to: 'CLOSED', eventName: 'TalentPoolClosed' },
    ],
    initialState: 'ACTIVE',
    terminalStates: ['CLOSED'],
  };
  fsm.register(definition);
}
