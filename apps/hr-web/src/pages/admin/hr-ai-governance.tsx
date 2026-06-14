import {
  AdminDomainWorkspace,
  type DomainWorkspaceConfig,
} from './domain-workspace';
import { commandPayloads, commonNoBodyCommands } from './domain-workspace-helpers';

const hrAiConfig: DomainWorkspaceConfig = {
  eyebrow: 'Governance',
  title: 'HR AI Governance',
  subtitle: 'Govern AI use cases, model runs, bias tests, and kill switches.',
  entities: [
    {
      key: 'use-cases',
      label: 'Use Cases',
      aggregateType: 'HrAiUseCase',
      listPath: (tenantId) => `/hr-ai-governance/use-cases/tenant/${tenantId}`,
      createPath: '/hr-ai-governance/use-cases',
      createLabel: 'Register use case',
      titleField: 'useCaseName',
      secondaryField: 'riskClassification',
      fields: [
        { key: 'hrAiUseCaseId', label: 'Use case ID', required: true, defaultValue: commandPayloads.generatedUseCaseId() },
        { key: 'useCaseName', label: 'Use case name', required: true },
        { key: 'useCaseType', label: 'Use case type', required: true, defaultValue: 'WORKFORCE_ANALYTICS' },
        { key: 'riskClassification', label: 'Risk classification', required: true, defaultValue: 'MEDIUM' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ],
      commandBasePath: (id) => `/hr-ai-governance/use-cases/${id}/commands`,
      commandMappings: [
        { tokens: ['approve'], command: 'approve' },
        ...commonNoBodyCommands,
      ],
    },
    {
      key: 'model-runs',
      label: 'Model Runs',
      aggregateType: 'HrAiModelRun',
      listPath: (tenantId) => `/hr-ai-governance/model-runs/tenant/${tenantId}`,
      createPath: '/hr-ai-governance/model-runs',
      createLabel: 'Log model run',
      titleField: 'modelVersion',
      secondaryField: 'useCaseId',
      fields: [
        { key: 'hrAiModelRunId', label: 'Model run ID', required: true, defaultValue: commandPayloads.generatedUseCaseId() },
        { key: 'useCaseId', label: 'Use case ID', required: true },
        { key: 'modelVersion', label: 'Model version', required: true },
      ],
      commandBasePath: (id) => `/hr-ai-governance/model-runs/${id}/commands`,
      commandMappings: [
        { tokens: ['complete'], command: 'complete', payload: commandPayloads.completeModelRun },
        { tokens: ['fail'], command: 'fail', payload: commandPayloads.failModelRun },
        ...commonNoBodyCommands,
      ],
    },
    {
      key: 'bias-tests',
      label: 'Bias Tests',
      aggregateType: 'HrAiBiasTest',
      listPath: (tenantId) => `/hr-ai-governance/bias-tests/tenant/${tenantId}`,
      createPath: '/hr-ai-governance/bias-tests',
      createLabel: 'Plan bias test',
      titleField: 'testType',
      secondaryField: 'useCaseId',
      fields: [
        { key: 'hrAiBiasTestId', label: 'Bias test ID', required: true, defaultValue: commandPayloads.generatedUseCaseId() },
        { key: 'useCaseId', label: 'Use case ID', required: true },
        { key: 'testType', label: 'Test type', required: true, defaultValue: 'ADVERSE_IMPACT' },
        { key: 'threshold', label: 'Threshold', type: 'number', defaultValue: '0.08' },
      ],
      commandBasePath: (id) => `/hr-ai-governance/bias-tests/${id}/commands`,
      commandMappings: [
        { tokens: ['complete'], command: 'complete', payload: commandPayloads.completeBiasTest },
        { tokens: ['fail'], command: 'fail', payload: commandPayloads.failBiasTest },
        ...commonNoBodyCommands,
      ],
    },
    {
      key: 'kill-switches',
      label: 'Kill Switches',
      aggregateType: 'HrAiKillSwitch',
      listPath: (tenantId) => `/hr-ai-governance/kill-switches/tenant/${tenantId}`,
      createPath: '/hr-ai-governance/kill-switches',
      createLabel: 'Arm kill switch',
      titleField: 'triggerReason',
      secondaryField: 'useCaseId',
      fields: [
        { key: 'hrAiKillSwitchId', label: 'Kill switch ID', required: true, defaultValue: commandPayloads.generatedUseCaseId() },
        { key: 'useCaseId', label: 'Use case ID', required: true },
        { key: 'triggeredBy', label: 'Triggered by', required: true },
        { key: 'triggerReason', label: 'Trigger reason', required: true },
      ],
      commandBasePath: (id) => `/hr-ai-governance/kill-switches/${id}/commands`,
      commandMappings: [
        { tokens: ['resolve'], command: 'resolve', payload: commandPayloads.resolveKillSwitch },
        ...commonNoBodyCommands,
      ],
    },
  ],
};

export function AdminHrAiGovernance() {
  return <AdminDomainWorkspace config={hrAiConfig} />;
}
