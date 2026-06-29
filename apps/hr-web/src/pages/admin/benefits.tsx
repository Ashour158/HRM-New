import { AdminDomainWorkspace, type DomainWorkspaceConfig } from './domain-workspace';

/**
 * Native benefits workspace (config-driven, like union-labor / engagement).
 * Wired to the real `hr/benefits` controller: benefits programs (tenant-scoped list +
 * create). The create command requires a client-generated programId, supplied via
 * generateIdField.
 */
const benefitsConfig: DomainWorkspaceConfig = {
  eyebrow: 'Benefits',
  title: 'Benefits Administration',
  subtitle: 'Define benefits programs, carriers, and effective windows.',
  entities: [
    {
      key: 'benefits-programs',
      label: 'Benefits Programs',
      aggregateType: 'BenefitsProgram',
      // GET /hr/benefits/programs lists the tenant's programs (tenant scoped via RLS);
      // the tenantId arg is unused here.
      listPath: () => '/hr/benefits/programs',
      createPath: '/hr/benefits/programs',
      createLabel: 'Create program',
      generateIdField: 'programId',
      titleField: 'programName',
      secondaryField: 'programType',
      fields: [
        { key: 'programName', label: 'Program name', required: true },
        { key: 'programType', label: 'Program type', required: true, defaultValue: 'MEDICAL' },
        { key: 'carrierId', label: 'Carrier ID (optional)' },
        { key: 'effectiveFrom', label: 'Effective from', type: 'date' },
        { key: 'effectiveUntil', label: 'Effective until', type: 'date' },
      ],
      commandBasePath: (id) => `/hr/benefits/programs/${id}/commands`,
      commandMappings: [],
    },
  ],
};

export function AdminBenefits() {
  return <AdminDomainWorkspace config={benefitsConfig} />;
}

export default AdminBenefits;
