import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerCareerPathFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'CareerPath',
    states: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    actions: ['CreateCareerPath', 'ActivateCareerPath', 'AchieveCareerPathMilestone', 'ArchiveCareerPath'],
    transitions: [
      { action: 'CreateCareerPath', from: 'DRAFT', to: 'DRAFT', eventName: 'CareerPathCreated' },
      { action: 'ActivateCareerPath', from: 'DRAFT', to: 'ACTIVE', eventName: 'CareerPathActivated' },
      { action: 'AchieveCareerPathMilestone', from: 'ACTIVE', to: 'ACTIVE', eventName: 'CareerPathMilestoneAchieved' },
      { action: 'ArchiveCareerPath', from: 'DRAFT', to: 'ARCHIVED', eventName: 'CareerPathArchived' },
      { action: 'ArchiveCareerPath', from: 'ACTIVE', to: 'ARCHIVED', eventName: 'CareerPathArchived' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ARCHIVED'],
  };
  fsm.register(definition);
}
