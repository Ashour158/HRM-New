/**
 * Shared frontend types for the HR/HCM platform.
 */

/** Application user representing the authenticated identity. */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  roles: Role[];
  permissions: Permission[];
  tenantId: string;
}

/** Role assigned to a user. */
export interface Role {
  id: string;
  name: string;
  description?: string;
}

/** Permission granted to a user. */
export interface Permission {
  id: string;
  resource: string;
  action: string;
}

/** Tenant/organization context. */
export interface Tenant {
  id: string;
  name: string;
  logoUrl?: string;
  config: TenantConfig;
}

/** Tenant-specific configuration. */
export interface TenantConfig {
  currency: string;
  dateFormat: string;
  timezone: string;
  features: string[];
}

/** Worker/employee record. */
export interface Worker {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  hireDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | 'ON_LEAVE';
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
  managerId?: string;
  managerName?: string;
  legalEntityId?: string;
  legalEntityName?: string;
}

/** Standard API response wrapper. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  correlationId: string;
}

/** Paginated response wrapper. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Filter options for list queries. */
export interface FilterOptions {
  search?: string;
  status?: string;
  departmentId?: string;
  legalEntityId?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: string | undefined;
}

/** Field access decision from backend policy engine. */
export type FieldDecision = 'VISIBLE' | 'MASKED' | 'HIDDEN' | 'REQUIRES_STEP_UP';

/** Field access response. */
export interface FieldAccessResult {
  value: unknown;
  decision: FieldDecision;
  maskingRule?: string;
  reason?: string;
}

/** Allowed action returned by backend. */
export interface AllowedAction {
  id: string;
  label: string;
  action: string;
  requiresReason?: boolean;
}

/** Audit log entry. */
export interface AuditEntry {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/** Payslip record. */
export interface Payslip {
  id: string;
  workerId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  grossPay: number;
  netPay: number;
  deductions: number;
  taxes: number;
  currency: string;
  pdfUrl?: string;
}

/** Absence/time-off request. */
export interface AbsenceRequest {
  id: string;
  workerId: string;
  type: string;
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason?: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

/** Benefit enrollment. */
export interface BenefitEnrollment {
  id: string;
  workerId: string;
  benefitType: string;
  planName: string;
  coverageLevel: string;
  effectiveDate: string;
  status: 'ACTIVE' | 'PENDING' | 'TERMINATED';
}

/** Notification item. */
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  link?: string;
}

/** Country policy pack. */
export interface CountryPolicyPack {
  id: string;
  countryCode: string;
  version: string;
  name: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  validationResult?: ValidationResult;
}

/** Validation result for policy packs. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Org unit/department. */
export interface OrgUnit {
  id: string;
  name: string;
  type: 'LEGAL_ENTITY' | 'DEPARTMENT' | 'DIVISION' | 'TEAM';
  parentId?: string;
  managerId?: string;
  managerName?: string;
  headcount: number;
}
