import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerWellnessProgramFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'WellnessProgram',
    states: ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'],
    actions: ['CreateWellnessProgram', 'ActivateWellnessProgram', 'EnrollWellnessProgram', 'CompleteWellnessProgram', 'CancelWellnessProgram', 'ArchiveWellnessProgram'],
    transitions: [
      { action: 'CreateWellnessProgram', from: '', to: 'DRAFT', eventName: 'WellnessProgramCreated' },
      { action: 'ActivateWellnessProgram', from: 'DRAFT', to: 'ACTIVE', eventName: 'WellnessProgramActivated' },
      { action: 'EnrollWellnessProgram', from: 'ACTIVE', to: 'ACTIVE', eventName: 'WellnessProgramEnrolled' },
      { action: 'CompleteWellnessProgram', from: 'ACTIVE', to: 'COMPLETED', eventName: 'WellnessProgramCompleted' },
      { action: 'CancelWellnessProgram', from: 'DRAFT', to: 'CANCELLED', eventName: 'WellnessProgramCancelled' },
      { action: 'CancelWellnessProgram', from: 'ACTIVE', to: 'CANCELLED', eventName: 'WellnessProgramCancelled' },
      { action: 'ArchiveWellnessProgram', from: 'COMPLETED', to: 'ARCHIVED', eventName: 'WellnessProgramArchived' },
      { action: 'ArchiveWellnessProgram', from: 'CANCELLED', to: 'ARCHIVED', eventName: 'WellnessProgramArchived' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ARCHIVED'],
  };
  fsm.register(definition);
}
