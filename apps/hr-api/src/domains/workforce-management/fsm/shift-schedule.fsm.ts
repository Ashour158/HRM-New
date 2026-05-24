import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerShiftScheduleFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'ShiftSchedule',
    states: ['DRAFT', 'PUBLISHED', 'ACTIVE', 'ARCHIVED'],
    actions: ['CreateShiftSchedule', 'PublishShiftSchedule', 'ActivateShiftSchedule', 'ArchiveShiftSchedule'],
    transitions: [
      { action: 'CreateShiftSchedule', from: 'DRAFT', to: 'DRAFT', eventName: 'ShiftScheduleCreated' },
      { action: 'PublishShiftSchedule', from: 'DRAFT', to: 'PUBLISHED', eventName: 'ShiftSchedulePublished' },
      { action: 'ActivateShiftSchedule', from: 'PUBLISHED', to: 'ACTIVE', eventName: 'ShiftScheduleActivated' },
      { action: 'ArchiveShiftSchedule', from: 'ACTIVE', to: 'ARCHIVED', eventName: 'ShiftScheduleArchived' },
      { action: 'ArchiveShiftSchedule', from: 'PUBLISHED', to: 'ARCHIVED', eventName: 'ShiftScheduleArchived' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ARCHIVED'],
  };
  fsm.register(definition);
}
