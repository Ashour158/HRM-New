import { tallyBy } from './stats-utils.js';

export const UNSPECIFIED_GENDER = 'UNSPECIFIED';
export const UNASSIGNED_DEPARTMENT = 'UNASSIGNED';

export interface WorkforceSnapshotWorker {
  workerId: string;
  gender: string;
  departmentId?: string;
  employmentType: string;
  /** True if another active worker's managerId points at this worker (i.e. this worker leads people). */
  isManager: boolean;
}

/**
 * Computes real workforce-composition metrics (headcount by gender,
 * department, employment type, and leadership representation) from a
 * snapshot of a legal entity's current workforce. Every breakdown cell
 * surfaces a `headcount` so the existing k-anonymity suppression can redact
 * small cohorts before publication.
 */
export function computeWorkforceMetrics(workers: WorkforceSnapshotWorker[]): Record<string, unknown> {
  const leaders = workers.filter((w) => w.isManager);

  return {
    totalHeadcount: workers.length,
    genderDistribution: tallyBy(workers, (w) => w.gender || UNSPECIFIED_GENDER),
    departmentDistribution: tallyBy(workers, (w) => w.departmentId ?? UNASSIGNED_DEPARTMENT),
    employmentTypeDistribution: tallyBy(workers, (w) => w.employmentType),
    leadershipRepresentation: tallyBy(leaders, (w) => w.gender || UNSPECIFIED_GENDER),
  };
}
