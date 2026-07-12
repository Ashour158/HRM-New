/**
 * Prebuilt Report Library registry.
 *
 * A fixed, shared catalog of "prebuilt" (not ad-hoc query-builder) reports,
 * grouped into the three Zoho-style scope tiers:
 *   - MY:   the logged-in worker's own data only
 *   - TEAM: a manager's direct reports only
 *   - ORG:  tenant-wide, admin/HR scoped (served by the existing
 *           `/reporting/*` ad-hoc query builder and template catalog;
 *           represented here only as a metadata pointer so all three tiers
 *           can be rendered from one shared structure)
 *
 * This registry is intentionally lightweight (title/description/scope
 * metadata only) - the actual data for MY and TEAM reports is produced by
 * ReportLibraryController, which resolves the caller's own worker identity
 * (or their direct reports) server-side and never trusts a client-supplied
 * worker id.
 */

export type ReportLibraryTier = 'MY' | 'TEAM' | 'ORG';

/** DATA reports execute and return data via this library's run endpoints.
 *  LINK reports point at an existing page that already covers the data
 *  (e.g. payslip history) so the library doesn't duplicate it. */
export type ReportLibraryKind = 'DATA' | 'LINK';

export interface ReportLibraryDefinition {
  key: string;
  tier: ReportLibraryTier;
  title: string;
  description: string;
  /** Underlying HR data domain(s) this report is built from. */
  dataDomains: string[];
  kind: ReportLibraryKind;
  /** Present only when kind === 'LINK'. */
  linkTo?: string;
}

export const REPORT_LIBRARY_DEFINITIONS: readonly ReportLibraryDefinition[] = [
  {
    key: 'my-time-off-balance',
    tier: 'MY',
    title: 'Time-Off Balance & History',
    description: 'Your accrual balances, entitlement calculations, and leave request history.',
    dataDomains: ['LEAVE'],
    kind: 'DATA',
  },
  {
    key: 'my-attendance-summary',
    tier: 'MY',
    title: 'Attendance Summary',
    description: 'Your clock-in/out activity, payable hours, and exceptions for the last 30 days.',
    dataDomains: ['ATTENDANCE'],
    kind: 'DATA',
  },
  {
    key: 'my-learning-progress',
    tier: 'MY',
    title: 'Learning Progress',
    description: 'Your course assignments, completion status, and certification standing.',
    dataDomains: ['LEARNING'],
    kind: 'DATA',
  },
  {
    key: 'my-compensation-payslip',
    tier: 'MY',
    title: 'Compensation & Payslip History',
    description: 'View your payslip history and compensation details.',
    dataDomains: ['PAYROLL'],
    kind: 'LINK',
    linkTo: '/employee/payslip',
  },
  {
    key: 'team-attendance-summary',
    tier: 'TEAM',
    title: 'Team Attendance Summary',
    description: 'Clock-in/out activity, payable hours, and exceptions across your direct reports.',
    dataDomains: ['ATTENDANCE'],
    kind: 'DATA',
  },
  {
    key: 'team-leave-calendar',
    tier: 'TEAM',
    title: 'Team Leave Calendar',
    description: 'Upcoming and active absences across your direct reports.',
    dataDomains: ['LEAVE'],
    kind: 'DATA',
  },
  {
    key: 'team-performance-distribution',
    tier: 'TEAM',
    title: 'Team Performance Distribution',
    description: 'Rating and goal-progress distribution across your direct reports.',
    dataDomains: ['PERFORMANCE'],
    kind: 'DATA',
  },
  {
    key: 'org-report-library',
    tier: 'ORG',
    title: 'Organization Report Library',
    description: 'Prebuilt templates, analytics packs, and the ad-hoc report builder for HR and admin roles.',
    dataDomains: ['HEADCOUNT', 'ATTENDANCE', 'LEAVE', 'PAYROLL', 'PERFORMANCE', 'BENEFITS', 'COMPLIANCE', 'SERVICES', 'ENGAGEMENT'],
    kind: 'LINK',
    linkTo: '/admin/reports',
  },
] as const;

export function reportLibraryDefinitionsForTier(tier: ReportLibraryTier): ReportLibraryDefinition[] {
  return REPORT_LIBRARY_DEFINITIONS.filter((definition) => definition.tier === tier);
}

export function findReportLibraryDefinition(tier: ReportLibraryTier, key: string): ReportLibraryDefinition | undefined {
  return REPORT_LIBRARY_DEFINITIONS.find((definition) => definition.tier === tier && definition.key === key);
}
