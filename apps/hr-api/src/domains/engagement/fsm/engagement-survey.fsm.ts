import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerEngagementSurveyFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'EngagementSurvey',
    states: ['DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'ANALYZED', 'CANCELLED'],
    actions: ['CreateEngagementSurvey', 'PublishEngagementSurvey', 'ActivateEngagementSurvey', 'CloseEngagementSurvey', 'AnalyzeEngagementSurvey'],
    transitions: [
      { action: 'CreateEngagementSurvey', from: 'DRAFT', to: 'DRAFT', eventName: 'EngagementSurveyCreated' },
      { action: 'PublishEngagementSurvey', from: 'DRAFT', to: 'PUBLISHED', eventName: 'EngagementSurveyPublished' },
      { action: 'ActivateEngagementSurvey', from: 'PUBLISHED', to: 'ACTIVE', eventName: 'EngagementSurveyActivated' },
      { action: 'CloseEngagementSurvey', from: 'ACTIVE', to: 'CLOSED', eventName: 'EngagementSurveyClosed' },
      { action: 'AnalyzeEngagementSurvey', from: 'CLOSED', to: 'ANALYZED', eventName: 'EngagementSurveyAnalyzed' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ANALYZED', 'CANCELLED'],
  };
  fsm.register(definition);
}
