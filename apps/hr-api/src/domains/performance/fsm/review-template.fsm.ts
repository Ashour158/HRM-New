import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerReviewTemplateFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'ReviewTemplate',
    states: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    actions: ['CreateReviewTemplate', 'PublishReviewTemplate', 'ArchiveReviewTemplate'],
    transitions: [
      { action: 'CreateReviewTemplate', from: 'DRAFT', to: 'DRAFT', eventName: 'ReviewTemplateCreated' },
      { action: 'PublishReviewTemplate', from: 'DRAFT', to: 'ACTIVE', eventName: 'ReviewTemplatePublished' },
      { action: 'ArchiveReviewTemplate', from: 'ACTIVE', to: 'ARCHIVED', eventName: 'ReviewTemplateArchived' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ARCHIVED'],
  };
  fsm.register(definition);
}
