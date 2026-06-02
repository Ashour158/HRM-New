/**
 * @file Permission Catalog
 * @description Canonical permission constants organized by HR domain.
 */

// Worker domain
export const WORKER_READ = 'WORKER_READ';
export const WORKER_CREATE = 'WORKER_CREATE';
export const WORKER_UPDATE = 'WORKER_UPDATE';
export const WORKER_TERMINATE = 'WORKER_TERMINATE';
export const WORKER_REACTIVATE = 'WORKER_REACTIVATE';

// Organization domain
export const ORG_READ = 'ORG_READ';
export const ORG_CREATE = 'ORG_CREATE';
export const ORG_UPDATE = 'ORG_UPDATE';
export const ORG_DELETE = 'ORG_DELETE';

// Position domain
export const POSITION_READ = 'POSITION_READ';
export const POSITION_CREATE = 'POSITION_CREATE';
export const POSITION_APPROVE = 'POSITION_APPROVE';

// Recruiting domain
export const RECRUITING_READ = 'RECRUITING_READ';
export const RECRUITING_CREATE = 'RECRUITING_CREATE';
export const RECRUITING_APPROVE = 'RECRUITING_APPROVE';
export const RECRUITING_PUBLISH = 'RECRUITING_PUBLISH';

// Payroll domain
export const PAYROLL_READ = 'PAYROLL_READ';
export const PAYROLL_CREATE = 'PAYROLL_CREATE';
export const PAYROLL_APPROVE = 'PAYROLL_APPROVE';
export const PAYROLL_EXPORT = 'PAYROLL_EXPORT';

// Benefits domain
export const BENEFITS_READ = 'BENEFITS_READ';
export const BENEFITS_ENROLL = 'BENEFITS_ENROLL';
export const BENEFITS_APPROVE = 'BENEFITS_APPROVE';

// Compensation domain
export const COMPENSATION_READ = 'COMPENSATION_READ';
export const COMPENSATION_CHANGE = 'COMPENSATION_CHANGE';
export const COMPENSATION_APPROVE = 'COMPENSATION_APPROVE';

// Performance domain
export const PERFORMANCE_READ = 'PERFORMANCE_READ';
export const PERFORMANCE_CREATE = 'PERFORMANCE_CREATE';
export const PERFORMANCE_WRITE = 'PERFORMANCE_WRITE';
export const PERFORMANCE_APPROVE = 'PERFORMANCE_APPROVE';

// Learning domain
export const LEARNING_READ = 'LEARNING_READ';
export const LEARNING_ASSIGN = 'LEARNING_ASSIGN';
export const LEARNING_APPROVE = 'LEARNING_APPROVE';

// Absence domain
export const ABSENCE_READ = 'ABSENCE_READ';
export const ABSENCE_APPROVE = 'ABSENCE_APPROVE';
export const ABSENCE_MANAGE = 'ABSENCE_MANAGE';

// Time domain
export const TIME_READ = 'TIME_READ';
export const TIME_APPROVE = 'TIME_APPROVE';
export const TIME_MANAGE = 'TIME_MANAGE';

// Workforce scheduling domain
export const WORKFORCE_READ = 'WORKFORCE_READ';
export const WORKFORCE_SCHEDULE = 'WORKFORCE_SCHEDULE';
export const WORKFORCE_APPROVE = 'WORKFORCE_APPROVE';

// Employee Relations domain
export const ER_CASE_READ = 'ER_CASE_READ';
export const ER_CASE_CREATE = 'ER_CASE_CREATE';
export const ER_CASE_INVESTIGATE = 'ER_CASE_INVESTIGATE';
export const ER_CASE_CLOSE = 'ER_CASE_CLOSE';

// HR Service Delivery domain
export const SERVICE_READ = 'SERVICE_READ';
export const SERVICE_REQUEST = 'SERVICE_REQUEST';
export const SERVICE_MANAGE = 'SERVICE_MANAGE';

// Compliance domain
export const COMPLIANCE_READ = 'COMPLIANCE_READ';
export const COMPLIANCE_MANAGE = 'COMPLIANCE_MANAGE';
export const LEGAL_HOLD_MANAGE = 'LEGAL_HOLD_MANAGE';

// Reporting domain
export const REPORT_READ = 'REPORT_READ';
export const REPORT_CREATE = 'REPORT_CREATE';
export const REPORT_EXPORT = 'REPORT_EXPORT';

// Admin domain
export const ADMIN_SYSTEM = 'ADMIN_SYSTEM';
export const ADMIN_TENANT = 'ADMIN_TENANT';
export const ADMIN_SECURITY = 'ADMIN_SECURITY';

/** All canonical permissions as an array. */
export const ALL_PERMISSIONS: readonly string[] = [
  WORKER_READ, WORKER_CREATE, WORKER_UPDATE, WORKER_TERMINATE, WORKER_REACTIVATE,
  ORG_READ, ORG_CREATE, ORG_UPDATE, ORG_DELETE,
  POSITION_READ, POSITION_CREATE, POSITION_APPROVE,
  RECRUITING_READ, RECRUITING_CREATE, RECRUITING_APPROVE, RECRUITING_PUBLISH,
  PAYROLL_READ, PAYROLL_CREATE, PAYROLL_APPROVE, PAYROLL_EXPORT,
  BENEFITS_READ, BENEFITS_ENROLL, BENEFITS_APPROVE,
  COMPENSATION_READ, COMPENSATION_CHANGE, COMPENSATION_APPROVE,
  PERFORMANCE_READ, PERFORMANCE_CREATE, PERFORMANCE_WRITE, PERFORMANCE_APPROVE,
  LEARNING_READ, LEARNING_ASSIGN, LEARNING_APPROVE,
  ABSENCE_READ, ABSENCE_APPROVE, ABSENCE_MANAGE,
  TIME_READ, TIME_APPROVE, TIME_MANAGE,
  WORKFORCE_READ, WORKFORCE_SCHEDULE, WORKFORCE_APPROVE,
  ER_CASE_READ, ER_CASE_CREATE, ER_CASE_INVESTIGATE, ER_CASE_CLOSE,
  SERVICE_READ, SERVICE_REQUEST, SERVICE_MANAGE,
  COMPLIANCE_READ, COMPLIANCE_MANAGE, LEGAL_HOLD_MANAGE,
  REPORT_READ, REPORT_CREATE, REPORT_EXPORT,
  ADMIN_SYSTEM, ADMIN_TENANT, ADMIN_SECURITY,
];

/** Data classification levels required to exercise a permission. */
export type DataClassification = 'LOW' | 'CONFIDENTIAL' | 'HIGH_SENSITIVITY' | 'SPECIAL_CATEGORY' | 'LEGAL_HOLD';

export interface PermissionDefinition {
  /** Canonical permission code */
  code: string;
  /** Human-readable description */
  description: string;
  /** Minimum data classification the actor must be authorized for */
  dataClassificationRequired: DataClassification;
  /** Whether access is audited */
  auditOnAccess: boolean;
}

const PERMISSION_CATALOG: Record<string, PermissionDefinition> = {
  [WORKER_READ]: { code: WORKER_READ, description: 'Read worker profile data', dataClassificationRequired: 'LOW', auditOnAccess: false },
  [WORKER_CREATE]: { code: WORKER_CREATE, description: 'Create a new worker record', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [WORKER_UPDATE]: { code: WORKER_UPDATE, description: 'Update worker profile data', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [WORKER_TERMINATE]: { code: WORKER_TERMINATE, description: 'Terminate a worker', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [WORKER_REACTIVATE]: { code: WORKER_REACTIVATE, description: 'Reactivate a terminated worker', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },

  [ORG_READ]: { code: ORG_READ, description: 'Read organization structure', dataClassificationRequired: 'LOW', auditOnAccess: false },
  [ORG_CREATE]: { code: ORG_CREATE, description: 'Create organization unit', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [ORG_UPDATE]: { code: ORG_UPDATE, description: 'Update organization unit', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [ORG_DELETE]: { code: ORG_DELETE, description: 'Delete organization unit', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },

  [POSITION_READ]: { code: POSITION_READ, description: 'Read position data', dataClassificationRequired: 'LOW', auditOnAccess: false },
  [POSITION_CREATE]: { code: POSITION_CREATE, description: 'Create position', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [POSITION_APPROVE]: { code: POSITION_APPROVE, description: 'Approve position changes', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },

  [RECRUITING_READ]: { code: RECRUITING_READ, description: 'Read recruiting data', dataClassificationRequired: 'LOW', auditOnAccess: false },
  [RECRUITING_CREATE]: { code: RECRUITING_CREATE, description: 'Create requisitions/candidates', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [RECRUITING_APPROVE]: { code: RECRUITING_APPROVE, description: 'Approve recruiting actions', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [RECRUITING_PUBLISH]: { code: RECRUITING_PUBLISH, description: 'Publish job postings', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },

  [PAYROLL_READ]: { code: PAYROLL_READ, description: 'Read payroll data', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [PAYROLL_CREATE]: { code: PAYROLL_CREATE, description: 'Create payroll inputs/cycles', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [PAYROLL_APPROVE]: { code: PAYROLL_APPROVE, description: 'Approve payroll runs', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [PAYROLL_EXPORT]: { code: PAYROLL_EXPORT, description: 'Export payroll data', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },

  [BENEFITS_READ]: { code: BENEFITS_READ, description: 'Read benefits data', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: false },
  [BENEFITS_ENROLL]: { code: BENEFITS_ENROLL, description: 'Enroll in benefits', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [BENEFITS_APPROVE]: { code: BENEFITS_APPROVE, description: 'Approve benefit elections', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },

  [COMPENSATION_READ]: { code: COMPENSATION_READ, description: 'Read compensation data', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [COMPENSATION_CHANGE]: { code: COMPENSATION_CHANGE, description: 'Propose compensation changes', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [COMPENSATION_APPROVE]: { code: COMPENSATION_APPROVE, description: 'Approve compensation changes', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },

  [PERFORMANCE_READ]: { code: PERFORMANCE_READ, description: 'Read performance data', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: false },
  [PERFORMANCE_CREATE]: { code: PERFORMANCE_CREATE, description: 'Create performance reviews', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [PERFORMANCE_WRITE]: { code: PERFORMANCE_WRITE, description: 'Write performance data', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [PERFORMANCE_APPROVE]: { code: PERFORMANCE_APPROVE, description: 'Approve performance ratings', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },

  [LEARNING_READ]: { code: LEARNING_READ, description: 'Read learning data', dataClassificationRequired: 'LOW', auditOnAccess: false },
  [LEARNING_ASSIGN]: { code: LEARNING_ASSIGN, description: 'Assign learning', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [LEARNING_APPROVE]: { code: LEARNING_APPROVE, description: 'Approve learning content', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },

  [ABSENCE_READ]: { code: ABSENCE_READ, description: 'Read absence data', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: false },
  [ABSENCE_APPROVE]: { code: ABSENCE_APPROVE, description: 'Approve absence requests', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [ABSENCE_MANAGE]: { code: ABSENCE_MANAGE, description: 'Manage absence records', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },

  [TIME_READ]: { code: TIME_READ, description: 'Read time records', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: false },
  [TIME_APPROVE]: { code: TIME_APPROVE, description: 'Approve timesheets', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [TIME_MANAGE]: { code: TIME_MANAGE, description: 'Manage time records', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },

  [WORKFORCE_READ]: { code: WORKFORCE_READ, description: 'Read workforce schedules and coverage plans', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: false },
  [WORKFORCE_SCHEDULE]: { code: WORKFORCE_SCHEDULE, description: 'Create and manage workforce schedules, rosters, and coverage gaps', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [WORKFORCE_APPROVE]: { code: WORKFORCE_APPROVE, description: 'Approve workforce scheduling, shift bids, swaps, overtime, and coverage actions', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },

  [ER_CASE_READ]: { code: ER_CASE_READ, description: 'Read ER case data', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [ER_CASE_CREATE]: { code: ER_CASE_CREATE, description: 'Create ER cases', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [ER_CASE_INVESTIGATE]: { code: ER_CASE_INVESTIGATE, description: 'Investigate ER cases', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [ER_CASE_CLOSE]: { code: ER_CASE_CLOSE, description: 'Close ER cases', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },

  [SERVICE_READ]: { code: SERVICE_READ, description: 'Read HR service catalog and service request cases', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: false },
  [SERVICE_REQUEST]: { code: SERVICE_REQUEST, description: 'Open employee HR service requests', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [SERVICE_MANAGE]: { code: SERVICE_MANAGE, description: 'Manage HR service delivery cases, tasks, knowledge articles, catalog items, and SLAs', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },

  [COMPLIANCE_READ]: { code: COMPLIANCE_READ, description: 'Read compliance data', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: false },
  [COMPLIANCE_MANAGE]: { code: COMPLIANCE_MANAGE, description: 'Manage compliance policies', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [LEGAL_HOLD_MANAGE]: { code: LEGAL_HOLD_MANAGE, description: 'Manage legal holds', dataClassificationRequired: 'SPECIAL_CATEGORY', auditOnAccess: true },

  [REPORT_READ]: { code: REPORT_READ, description: 'Read reports', dataClassificationRequired: 'LOW', auditOnAccess: false },
  [REPORT_CREATE]: { code: REPORT_CREATE, description: 'Create reports', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },
  [REPORT_EXPORT]: { code: REPORT_EXPORT, description: 'Export reports', dataClassificationRequired: 'CONFIDENTIAL', auditOnAccess: true },

  [ADMIN_SYSTEM]: { code: ADMIN_SYSTEM, description: 'System administration', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [ADMIN_TENANT]: { code: ADMIN_TENANT, description: 'Tenant administration', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
  [ADMIN_SECURITY]: { code: ADMIN_SECURITY, description: 'Security administration', dataClassificationRequired: 'HIGH_SENSITIVITY', auditOnAccess: true },
};

/** Retrieve permission definition by code. */
export function getPermissionDefinition(code: string): PermissionDefinition | undefined {
  return PERMISSION_CATALOG[code];
}

/** Retrieve all permission definitions. */
export function getAllPermissions(): PermissionDefinition[] {
  return Object.values(PERMISSION_CATALOG);
}
