import { AdminDomainWorkspace, type DomainWorkspaceConfig } from './domain-workspace';

/**
 * Native engagement workspace (config-driven, like union-labor / wellbeing-eap).
 * Wired to the real `engagement` domain controller: tenant-scoped survey list,
 * survey creation, and the survey lifecycle commands.
 */
const engagementConfig: DomainWorkspaceConfig = {
  eyebrow: 'Engagement',
  title: 'Engagement & Surveys',
  subtitle: 'Launch engagement surveys, drive the lifecycle, and analyze results.',
  entities: [
    {
      key: 'engagement-surveys',
      label: 'Engagement Surveys',
      aggregateType: 'EngagementSurvey',
      listPath: (tenantId) => `/engagement/surveys/tenant/${tenantId}`,
      createPath: '/engagement/surveys',
      createLabel: 'Create survey',
      titleField: 'title',
      secondaryField: 'surveyType',
      fields: [
        { key: 'title', label: 'Title', required: true },
        { key: 'surveyType', label: 'Survey type', required: true, defaultValue: 'PULSE' },
        { key: 'startDate', label: 'Start date', type: 'date' },
        { key: 'endDate', label: 'End date', type: 'date' },
      ],
      commandBasePath: (id) => `/engagement/surveys/${id}/commands`,
      commandMappings: [
        { tokens: ['publish'], command: 'publish' },
        { tokens: ['activate'], command: 'activate' },
        { tokens: ['close'], command: 'close' },
        { tokens: ['analyze'], command: 'analyze' },
      ],
    },
  ],
};

export function AdminEngagement() {
  return <AdminDomainWorkspace config={engagementConfig} />;
}

export default AdminEngagement;
