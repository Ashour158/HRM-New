import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerHrKnowledgeArticleFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'HrKnowledgeArticle',
    states: ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'DEPRECATED'],
    actions: ['CreateHrKnowledgeArticle', 'PublishHrKnowledgeArticle', 'ArchiveHrKnowledgeArticle'],
    transitions: [
      { action: 'CreateHrKnowledgeArticle', from: 'DRAFT', to: 'DRAFT', eventName: 'HrKnowledgeArticleCreated' },
      { action: 'PublishHrKnowledgeArticle', from: 'DRAFT', to: 'PUBLISHED', eventName: 'HrKnowledgeArticlePublished' },
      { action: 'ArchiveHrKnowledgeArticle', from: 'DRAFT', to: 'ARCHIVED', eventName: 'HrKnowledgeArticleArchived' },
      { action: 'ArchiveHrKnowledgeArticle', from: 'PUBLISHED', to: 'ARCHIVED', eventName: 'HrKnowledgeArticleArchived' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ARCHIVED', 'DEPRECATED'],
  };
  fsm.register(definition);
}
