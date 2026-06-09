export type AdminJourneyTone = 'attention' | 'default' | 'success' | 'warning';

export interface AdminJourneyItem {
  label: string;
  category: string;
  status: string;
  actionLabel: string;
  href: string;
  tone: AdminJourneyTone;
}

export interface AdminJourneySignals {
  alertsCount?: number;
  headcount?: number;
  highSeverityAlerts?: number;
  newHiresThisMonth?: number;
  openPositions?: number;
}

function positive(value?: number): number {
  return Math.max(value ?? 0, 0);
}

export function buildAdminJourneyItems(signals: AdminJourneySignals): AdminJourneyItem[] {
  const alertsCount = positive(signals.alertsCount);
  const highSeverityAlerts = positive(signals.highSeverityAlerts);
  const headcount = positive(signals.headcount);
  const newHiresThisMonth = positive(signals.newHiresThisMonth);
  const openPositions = positive(signals.openPositions);

  return [
    {
      label: 'System Console',
      category: 'Control',
      status: alertsCount > 0 ? `${alertsCount} alerts` : 'Ready',
      actionLabel: alertsCount > 0 ? 'Review work' : 'Open console',
      href: '/admin/system-console',
      tone: highSeverityAlerts > 0 || alertsCount > 0 ? 'attention' : 'success',
    },
    {
      label: 'Organization Setup',
      category: 'Foundation',
      status: headcount > 0 ? `${headcount} workers` : 'Start setup',
      actionLabel: headcount > 0 ? 'Review hierarchy' : 'Create structure',
      href: '/admin/organization',
      tone: headcount > 0 ? 'success' : 'warning',
    },
    {
      label: 'Create Employee',
      category: 'People',
      status: openPositions > 0 ? `${openPositions} open roles` : 'Roster ready',
      actionLabel: openPositions > 0 ? 'Add employee' : 'Open employee list',
      href: openPositions > 0 ? '/admin/employees/new' : '/admin/employees',
      tone: openPositions > 0 ? 'attention' : 'default',
    },
    {
      label: 'Policy Controls',
      category: 'Governance',
      status: alertsCount > 0 ? 'Check rules' : 'Available',
      actionLabel: 'Open policies',
      href: '/admin/system-console/policies',
      tone: alertsCount > 0 ? 'warning' : 'default',
    },
    {
      label: 'Payroll Readiness',
      category: 'Reward',
      status: newHiresThisMonth > 0 ? `${newHiresThisMonth} new hires` : 'Ready to review',
      actionLabel: 'Review payroll',
      href: '/admin/payroll',
      tone: 'default',
    },
    {
      label: 'HR Reports',
      category: 'Insights',
      status: 'Live dashboard',
      actionLabel: 'Open reports',
      href: '/admin/reports',
      tone: 'success',
    },
  ];
}
