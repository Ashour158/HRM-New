import {
  AdminDomainWorkspace,
  type DomainWorkspaceConfig,
} from './domain-workspace';
import { commandPayloads, commonNoBodyCommands } from './domain-workspace-helpers';

const wellbeingConfig: DomainWorkspaceConfig = {
  eyebrow: 'Wellbeing',
  title: 'Wellbeing & EAP',
  subtitle: 'Manage wellness programs, EAP referrals, and mental health cases with sensitive controls.',
  entities: [
    {
      key: 'wellness-programs',
      label: 'Wellness Programs',
      aggregateType: 'WellnessProgram',
      listPath: (tenantId) => `/wellbeing-eap/wellness-programs/tenant/${tenantId}`,
      createPath: '/wellbeing-eap/wellness-programs',
      createLabel: 'Create program',
      titleField: 'name',
      secondaryField: 'type',
      fields: [
        { key: 'name', label: 'Program name', required: true },
        { key: 'type', label: 'Program type', required: true, defaultValue: 'WELLNESS' },
        { key: 'startDate', label: 'Start date', type: 'date' },
        { key: 'endDate', label: 'End date', type: 'date' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ],
      commandBasePath: (id) => `/wellbeing-eap/wellness-programs/${id}/commands`,
      commandMappings: commonNoBodyCommands,
    },
    {
      key: 'eap-referrals',
      label: 'EAP Referrals',
      aggregateType: 'EapReferral',
      listPath: (tenantId) => `/wellbeing-eap/eap-referrals/tenant/${tenantId}`,
      createPath: '/wellbeing-eap/eap-referrals',
      createLabel: 'Create referral',
      titleField: 'reason',
      secondaryField: 'workerId',
      fields: [
        { key: 'workerId', label: 'Worker ID', required: true },
        { key: 'reason', label: 'Reason', required: true },
        { key: 'scheduledDate', label: 'Scheduled date', type: 'date' },
        { key: 'providerId', label: 'Provider ID' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ],
      commandBasePath: (id) => `/wellbeing-eap/eap-referrals/${id}/commands`,
      commandMappings: [
        { tokens: ['schedule'], command: 'schedule', payload: commandPayloads.scheduleReferral },
        ...commonNoBodyCommands,
      ],
    },
    {
      key: 'mental-health-cases',
      label: 'Mental Health Cases',
      aggregateType: 'MentalHealthCase',
      listPath: (tenantId) => `/wellbeing-eap/mental-health-cases/tenant/${tenantId}`,
      createPath: '/wellbeing-eap/mental-health-cases',
      createLabel: 'Open case',
      titleField: 'severity',
      secondaryField: 'workerId',
      fields: [
        { key: 'workerId', label: 'Worker ID', required: true },
        { key: 'severity', label: 'Severity', required: true, defaultValue: 'MEDIUM' },
        { key: 'providerId', label: 'Provider ID' },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ],
      commandBasePath: (id) => `/wellbeing-eap/mental-health-cases/${id}/commands`,
      commandMappings: commonNoBodyCommands,
    },
  ],
};

export function AdminWellbeingEap() {
  return <AdminDomainWorkspace config={wellbeingConfig} />;
}
