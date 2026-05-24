import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerSkillProfileFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'SkillProfile',
    states: ['ACTIVE', 'UNDER_REVIEW', 'UPDATED', 'ARCHIVED'],
    actions: ['CreateSkillProfile', 'UpdateSkillProfile', 'ValidateSkillProfile', 'ArchiveSkillProfile'],
    transitions: [
      { action: 'CreateSkillProfile', from: 'ACTIVE', to: 'ACTIVE', eventName: 'SkillProfileCreated' },
      { action: 'UpdateSkillProfile', from: 'ACTIVE', to: 'UPDATED', eventName: 'SkillProfileUpdated' },
      { action: 'UpdateSkillProfile', from: 'UPDATED', to: 'UPDATED', eventName: 'SkillProfileUpdated' },
      { action: 'ValidateSkillProfile', from: 'UPDATED', to: 'ACTIVE', eventName: 'SkillProfileValidated' },
      { action: 'ValidateSkillProfile', from: 'ACTIVE', to: 'ACTIVE', eventName: 'SkillProfileValidated' },
      { action: 'ArchiveSkillProfile', from: 'ACTIVE', to: 'ARCHIVED', eventName: 'SkillProfileArchived' },
      { action: 'ArchiveSkillProfile', from: 'UPDATED', to: 'ARCHIVED', eventName: 'SkillProfileArchived' },
    ],
    initialState: 'ACTIVE',
    terminalStates: ['ARCHIVED'],
  };
  fsm.register(definition);
}
