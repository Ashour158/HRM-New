/**
 * Shared types for the Prebuilt Report Library (My / Team / Organization tiers).
 * Mirrors apps/hr-api/src/domains/reporting/report-library/report-library.registry.ts
 */

export type ReportLibraryTier = 'MY' | 'TEAM' | 'ORG';
export type ReportLibraryKind = 'DATA' | 'LINK';

export interface ReportLibraryDefinition {
  key: string;
  tier: ReportLibraryTier;
  title: string;
  description: string;
  dataDomains: string[];
  kind: ReportLibraryKind;
  linkTo?: string;
}

export interface ReportLibraryCatalog {
  reports: ReportLibraryDefinition[];
}

/* ─────────────────────────── My Reports response shapes ─────────────────────────── */

export interface LeaveBalanceRow {
  type: string;
  label: string;
  total: number;
  used: number;
  remaining: number;
  unit: string;
}

export interface LeaveHistoryRow {
  id: string;
  type: string;
  startDate?: string;
  endDate?: string;
  status: string;
  calendarDays?: number;
  workingDays?: number;
  reason?: string;
}

export interface EntitlementCalculationRow {
  leaveType: string;
  calculatedEntitlement: number;
  usedEntitlement: number;
  remainingEntitlement: number;
  calculationDate?: string;
  status: string;
}

export interface TimeOffBalanceReport {
  definition: ReportLibraryDefinition;
  generatedAt: string;
  balances: LeaveBalanceRow[];
  history: LeaveHistoryRow[];
  entitlementCalculations: EntitlementCalculationRow[];
  summary: { pendingRequests: number; approvedRequests: number; totalRemaining: number };
}

export interface AttendancePeriodViewMetrics {
  employeeDays: number;
  present: number;
  absent: number;
  onLeave: number;
  exceptions: number;
  payableHours: number;
  deductionHours: number;
  overtimeHours: number;
  geofenceViolations: number;
  lateMinutes: number;
  missingCheckout: number;
  payrollReady: number;
  undertimeMinutes: number;
}

export interface AttendancePeriodViewDay extends AttendancePeriodViewMetrics {
  workDate: string;
}

export interface AttendancePeriodViewWorker extends AttendancePeriodViewMetrics {
  workerId: string;
  employeeId: string;
  name: string;
  departmentName?: string;
  managerId?: string;
}

export interface AttendanceSummaryReport {
  definition: ReportLibraryDefinition;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  range: string;
  scope: 'SELF' | 'TEAM' | 'TENANT';
  totals: AttendancePeriodViewMetrics;
  series: AttendancePeriodViewDay[];
  workers: AttendancePeriodViewWorker[];
}

export interface LearningAssignmentRow {
  id: string;
  courseId: string;
  courseTitle: string;
  status: string;
  assignedAt?: string;
  dueDate?: string;
  completedAt?: string;
  score?: number;
}

export interface CertificationRow {
  id: string;
  certificationName: string;
  issuingBody?: string;
  issueDate?: string;
  expiryDate?: string;
  status: string;
}

export interface LearningProgressReport {
  definition: ReportLibraryDefinition;
  generatedAt: string;
  assignments: LearningAssignmentRow[];
  certifications: CertificationRow[];
  summary: {
    totalAssigned: number;
    completed: number;
    inProgress: number;
    overdue: number;
    activeCertifications: number;
    expiredCertifications: number;
  };
}

/* ─────────────────────────── Team Reports response shapes ─────────────────────────── */

export interface UpcomingLeaveRow {
  id: string;
  workerId: string;
  workerName: string;
  type: string;
  startDate?: string;
  endDate?: string;
  status: string;
  calendarDays?: number;
  workingDays?: number;
}

export interface TeamLeaveCalendarReport {
  definition: ReportLibraryDefinition;
  generatedAt: string;
  upcoming: UpcomingLeaveRow[];
  summary: { teamSize: number; totalUpcoming: number; onLeaveToday: number };
}

export interface TeamPerformanceWorkerRow {
  workerId: string;
  workerName: string;
  latestRating: number | null;
  ratingBand: string;
  openGoals: number;
  achievedGoals: number;
  totalGoals: number;
  averageGoalProgress: number;
}

export interface TeamPerformanceDistributionReport {
  definition: ReportLibraryDefinition;
  generatedAt: string;
  workerCount: number;
  averageRating: number | null;
  ratingDistribution: Array<{ band: string; count: number }>;
  goalStatusDistribution: Array<{ status: string; count: number }>;
  workers: TeamPerformanceWorkerRow[];
}
