import { AdminDomainWorkspace, type DomainWorkspaceConfig } from './domain-workspace';
import { commonNoBodyCommands } from './domain-workspace-helpers';

const unionLaborConfig: DomainWorkspaceConfig = {
  eyebrow: 'Labor',
  title: 'Union & Labor',
  subtitle: 'Manage union recognitions, bargaining sessions, and grievances.',
  entities: [
    {
      key: 'union-recognitions',
      label: 'Union Recognitions',
      aggregateType: 'UnionRecognition',
      listPath: (tenantId) => `/union-labor/union-recognitions/tenant/${tenantId}`,
      createPath: '/union-labor/union-recognitions',
      createLabel: 'Record recognition',
      titleField: 'unionName',
      secondaryField: 'bargainingUnitId',
      fields: [
        { key: 'unionName', label: 'Union name', required: true },
        { key: 'bargainingUnitId', label: 'Bargaining unit ID', required: true },
        { key: 'effectiveDate', label: 'Effective date', type: 'date' },
        { key: 'expirationDate', label: 'Expiration date', type: 'date' },
        { key: 'agreementDocument', label: 'Agreement document reference' },
      ],
      commandBasePath: (id) => `/union-labor/union-recognitions/${id}/commands`,
      commandMappings: [
        { tokens: ['negotiate'], command: 'negotiate' },
        { tokens: ['ratify'], command: 'ratify' },
        { tokens: ['renew'], command: 'renew' },
        ...commonNoBodyCommands,
      ],
    },
    {
      key: 'collective-bargaining-sessions',
      label: 'Bargaining Sessions',
      aggregateType: 'CollectiveBargainingSession',
      listPath: (tenantId) => `/union-labor/collective-bargaining-sessions/tenant/${tenantId}`,
      createPath: '/union-labor/collective-bargaining-sessions',
      createLabel: 'Open session',
      titleField: 'unionRecognitionId',
      secondaryField: 'sessionDate',
      fields: [
        { key: 'unionRecognitionId', label: 'Union recognition ID', required: true },
        { key: 'sessionDate', label: 'Session date', type: 'date', required: true },
        { key: 'location', label: 'Location' },
        { key: 'agenda', label: 'Agenda', type: 'textarea' },
        { key: 'minutes', label: 'Minutes', type: 'textarea' },
      ],
      commandBasePath: (id) => `/union-labor/collective-bargaining-sessions/${id}/commands`,
      commandMappings: [
        { tokens: ['tentative'], command: 'record-tentative-agreement' },
        { tokens: ['mark failed'], command: 'mark-failed' },
        { tokens: ['ratify'], command: 'ratify' },
        ...commonNoBodyCommands,
      ],
    },
    {
      key: 'grievances',
      label: 'Grievances',
      aggregateType: 'Grievance',
      listPath: (tenantId) => `/union-labor/grievances/tenant/${tenantId}`,
      createPath: '/union-labor/grievances',
      createLabel: 'File grievance',
      titleField: 'grievanceType',
      secondaryField: 'workerId',
      fields: [
        { key: 'workerId', label: 'Worker ID', required: true },
        { key: 'grievanceType', label: 'Grievance type', required: true, defaultValue: 'WORKING_CONDITIONS' },
        { key: 'description', label: 'Description', type: 'textarea', required: true },
        { key: 'resolution', label: 'Resolution' },
        { key: 'arbitratorDecision', label: 'Arbitrator decision' },
      ],
      commandBasePath: (id) => `/union-labor/grievances/${id}/commands`,
      commandMappings: [
        { tokens: ['acknowledge'], command: 'acknowledge' },
        { tokens: ['start investigation'], command: 'start-investigation' },
        { tokens: ['arbitrate'], command: 'arbitrate' },
        { tokens: ['withdraw'], command: 'withdraw' },
        ...commonNoBodyCommands,
      ],
    },
  ],
};

export function AdminUnionLabor() {
  return <AdminDomainWorkspace config={unionLaborConfig} />;
}
