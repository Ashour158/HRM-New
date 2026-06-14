export type OrganizationSetupJourneyTone = 'attention' | 'default' | 'success' | 'warning';

export type OrganizationSetupTab =
  | 'assignments'
  | 'departments'
  | 'entities'
  | 'headcount'
  | 'managers'
  | 'planning'
  | 'positions'
  | 'structure'
  | 'vacancies';

export interface OrganizationSetupJourneyStep {
  actionLabel: string;
  category: string;
  completed: boolean;
  href?: string;
  label: string;
  status: string;
  targetTab?: OrganizationSetupTab;
  tone: OrganizationSetupJourneyTone;
}

export interface OrganizationSetupSignals {
  assignedWorkerCount?: number;
  legalEntityCount?: number;
  managerRelationshipCount?: number;
  orgUnitCount?: number;
  workerCount?: number;
}

function positive(value?: number): number {
  return Math.max(value ?? 0, 0);
}

export function buildOrganizationSetupJourney(signals: OrganizationSetupSignals): OrganizationSetupJourneyStep[] {
  const legalEntityCount = positive(signals.legalEntityCount);
  const orgUnitCount = positive(signals.orgUnitCount);
  const workerCount = positive(signals.workerCount);
  const assignedWorkerCount = positive(signals.assignedWorkerCount);
  const managerRelationshipCount = positive(signals.managerRelationshipCount);

  const hasLegalEntity = legalEntityCount > 0;
  const hasOrgUnits = orgUnitCount > 0;
  const hasWorkers = workerCount > 0;
  const hasAssignments = assignedWorkerCount > 0;
  const hasManagers = managerRelationshipCount > 0;

  return [
    {
      actionLabel: hasLegalEntity ? 'Review entities' : 'Add entity',
      category: 'Company',
      completed: hasLegalEntity,
      label: 'Legal Entity',
      status: hasLegalEntity ? `${legalEntityCount} configured` : 'Start here',
      targetTab: 'entities',
      tone: hasLegalEntity ? 'success' : 'attention',
    },
    {
      actionLabel: hasOrgUnits ? 'Review departments' : hasLegalEntity ? 'Add department' : 'Create entity first',
      category: 'Structure',
      completed: hasOrgUnits,
      label: 'Departments',
      status: hasOrgUnits ? `${orgUnitCount} departments` : hasLegalEntity ? 'Needs departments' : 'Needs entity',
      targetTab: hasLegalEntity ? 'departments' : 'entities',
      tone: hasOrgUnits ? 'success' : 'warning',
    },
    {
      actionLabel: hasWorkers ? 'Add another' : 'Create employee',
      category: 'People',
      completed: hasWorkers,
      href: '/admin/employees/new',
      label: 'Employee Records',
      status: hasWorkers ? `${workerCount} workers` : 'No workers',
      tone: hasWorkers ? 'success' : 'attention',
    },
    {
      actionLabel: hasAssignments ? 'Review assignments' : hasWorkers ? 'Assign workers' : 'Create employee first',
      category: 'Placement',
      completed: hasAssignments,
      label: 'Assignments',
      status: hasAssignments ? `${assignedWorkerCount} assigned` : 'No assignments',
      targetTab: 'assignments',
      tone: hasAssignments ? 'success' : 'warning',
    },
    {
      actionLabel: hasManagers ? 'Review reporting tree' : hasAssignments ? 'Assign managers' : 'Assign workers first',
      category: 'Reporting',
      completed: hasManagers,
      label: 'Manager Hierarchy',
      status: hasManagers ? `${managerRelationshipCount} reporting lines` : 'No managers',
      targetTab: 'managers',
      tone: hasManagers ? 'success' : 'warning',
    },
    {
      actionLabel: 'Open planning',
      category: 'Planning',
      completed: hasLegalEntity && hasOrgUnits && hasWorkers,
      label: 'Workforce Planning',
      status: hasLegalEntity && hasOrgUnits && hasWorkers ? 'Ready' : 'Needs setup',
      targetTab: 'planning',
      tone: hasLegalEntity && hasOrgUnits && hasWorkers ? 'success' : 'default',
    },
  ];
}
