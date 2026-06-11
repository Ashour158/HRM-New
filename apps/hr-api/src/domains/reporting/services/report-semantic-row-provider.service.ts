import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import { sql } from 'kysely';
import type { SemanticRow } from './report-semantic-query.service.js';

export const SEMANTIC_REPORT_ROW_PROVIDER = Symbol('SEMANTIC_REPORT_ROW_PROVIDER');

export interface SemanticReportRowProviderInput {
  dataSource: string;
  tenantId: string;
  maxRows: number;
}

export interface SemanticReportRowProviderResult {
  rows: SemanticRow[];
  warnings?: string[];
}

export interface SemanticReportRowProvider {
  loadRows(input: SemanticReportRowProviderInput): Promise<SemanticReportRowProviderResult | undefined>;
}

export interface SemanticReportRawSqlLoaderContract {
  name: string;
  tables: Array<{
    schema: string;
    table: string;
    columns: string[];
  }>;
}

export const SEMANTIC_REPORT_RAW_SQL_LOADERS: SemanticReportRawSqlLoaderContract[] = [
  {
    name: 'semantic-report.headcount',
    tables: [
      { schema: 'hr_core', table: 'workers', columns: ['tenant_id', 'id', 'employee_number', 'first_name', 'last_name', 'status', 'hire_date', 'legal_entity_id', 'department_id', 'manager_id', 'updated_at'] },
      { schema: 'hr_org', table: 'legal_entities', columns: ['tenant_id', 'id', 'code'] },
      { schema: 'hr_org', table: 'org_units', columns: ['tenant_id', 'id', 'code'] },
    ],
  },
  {
    name: 'semantic-report.attendance',
    tables: [
      { schema: 'hr_time', table: 'attendance_daily_ledgers', columns: ['tenant_id', 'worker_id', 'employee_id', 'worker_name', 'work_date', 'status', 'late_minutes', 'overtime_minutes', 'payable_minutes', 'exception_count', 'governance', 'updated_at'] },
      { schema: 'hr_core', table: 'workers', columns: ['tenant_id', 'id', 'legal_entity_id', 'department_id', 'manager_id'] },
    ],
  },
  {
    name: 'semantic-report.leave',
    tables: [
      { schema: 'hr_absence', table: 'absence_requests', columns: ['tenant_id', 'worker_id', 'absence_type', 'start_date', 'end_date', 'status', 'approved_by', 'updated_at'] },
      { schema: 'hr_core', table: 'workers', columns: ['tenant_id', 'id', 'employee_number', 'first_name', 'last_name', 'legal_entity_id', 'department_id', 'manager_id'] },
    ],
  },
  {
    name: 'semantic-report.payroll',
    tables: [
      { schema: 'hr_payroll', table: 'payroll_result_lines', columns: ['tenant_id', 'worker_id', 'payroll_cycle_id', 'line_type', 'amount', 'status', 'updated_at'] },
      { schema: 'hr_payroll', table: 'payroll_cycles', columns: ['tenant_id', 'id', 'pay_period_start', 'pay_period_end', 'status'] },
      { schema: 'hr_core', table: 'workers', columns: ['tenant_id', 'id', 'employee_number', 'first_name', 'last_name', 'legal_entity_id', 'department_id', 'manager_id'] },
    ],
  },
  {
    name: 'semantic-report.benefits',
    tables: [
      { schema: 'hr_benefits', table: 'benefits_enrollments', columns: ['tenant_id', 'worker_id', 'program_id', 'coverage_level', 'dependents', 'effective_date', 'status', 'updated_at'] },
      { schema: 'hr_benefits', table: 'benefits_programs', columns: ['tenant_id', 'id', 'program_name'] },
      { schema: 'hr_core', table: 'workers', columns: ['tenant_id', 'id', 'employee_number', 'first_name', 'last_name', 'legal_entity_id', 'department_id', 'manager_id'] },
    ],
  },
  {
    name: 'semantic-report.performance',
    tables: [
      { schema: 'hr_performance', table: 'performance_reviews', columns: ['tenant_id', 'worker_id', 'review_cycle_id', 'manager_id', 'status', 'final_rating', 'calibrated_rating', 'created_at', 'updated_at'] },
      { schema: 'hr_performance', table: 'performance_review_cycles', columns: ['tenant_id', 'id', 'name'] },
      { schema: 'hr_core', table: 'workers', columns: ['tenant_id', 'id', 'employee_number', 'first_name', 'last_name', 'legal_entity_id', 'department_id'] },
    ],
  },
  {
    name: 'semantic-report.compliance',
    tables: [
      { schema: 'hr_compliance', table: 'policy_acknowledgements', columns: ['tenant_id', 'worker_id', 'policy_document_id', 'acknowledged_at', 'due_date', 'status', 'updated_at'] },
      { schema: 'hr_compliance', table: 'policy_documents', columns: ['tenant_id', 'id', 'title', 'document_type'] },
      { schema: 'hr_core', table: 'workers', columns: ['tenant_id', 'id', 'employee_number', 'first_name', 'last_name', 'legal_entity_id', 'department_id', 'manager_id'] },
    ],
  },
  {
    name: 'semantic-report.services',
    tables: [
      { schema: 'hr_service_delivery', table: 'hr_service_cases', columns: ['tenant_id', 'requester_worker_id', 'case_number', 'case_type', 'status', 'assigned_to', 'sla_deadline', 'resolved_at', 'created_at', 'updated_at'] },
      { schema: 'hr_core', table: 'workers', columns: ['tenant_id', 'id', 'employee_number', 'first_name', 'last_name', 'legal_entity_id', 'department_id', 'manager_id'] },
    ],
  },
  {
    name: 'semantic-report.access',
    tables: [
      { schema: 'hr_platform', table: 'access_review_items', columns: ['tenant_id', 'campaign_id', 'subject_worker_id', 'role_id', 'permission_id', 'service_account_id', 'decision', 'created_at'] },
      { schema: 'hr_platform', table: 'access_review_campaigns', columns: ['tenant_id', 'id', 'name', 'status'] },
    ],
  },
  {
    name: 'semantic-report.onboarding',
    tables: [
      { schema: 'hr_onboarding', table: 'onboarding_plans', columns: ['tenant_id', 'worker_id', 'start_date', 'status', 'probation_status', 'updated_at'] },
      { schema: 'hr_core', table: 'workers', columns: ['tenant_id', 'id', 'employee_number', 'first_name', 'last_name', 'legal_entity_id', 'department_id', 'manager_id'] },
    ],
  },
];

@Injectable()
export class SqlSemanticReportRowProviderService implements SemanticReportRowProvider {
  private readonly db = createKyselyInstance(getPool());

  async loadRows(input: SemanticReportRowProviderInput): Promise<SemanticReportRowProviderResult | undefined> {
    const maxRows = Math.max(1, Math.min(1000, Math.trunc(input.maxRows)));
    const tenantId = input.tenantId;
    switch (input.dataSource) {
      case 'HEADCOUNT':
        return { rows: await this.loadHeadcount(tenantId, maxRows) };
      case 'ATTENDANCE':
        return { rows: await this.loadAttendance(tenantId, maxRows) };
      case 'LEAVE':
        return { rows: await this.loadLeave(tenantId, maxRows) };
      case 'PAYROLL':
        return { rows: await this.loadPayroll(tenantId, maxRows) };
      case 'BENEFITS':
        return { rows: await this.loadBenefits(tenantId, maxRows) };
      case 'PERFORMANCE':
        return { rows: await this.loadPerformance(tenantId, maxRows) };
      case 'COMPLIANCE':
        return { rows: await this.loadCompliance(tenantId, maxRows) };
      case 'SERVICES':
        return { rows: await this.loadServices(tenantId, maxRows) };
      case 'ACCESS':
        return { rows: await this.loadAccess(tenantId, maxRows) };
      case 'ONBOARDING':
        return { rows: await this.loadOnboarding(tenantId, maxRows) };
      default:
        return undefined;
    }
  }

  private async loadHeadcount(tenantId: string, maxRows: number): Promise<SemanticRow[]> {
    const result = await sql<Record<string, unknown>>`
      SELECT
        COALESCE(w.employee_number, w.id::text) AS "employeeNumber",
        w.id::text AS "workerKey",
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', w.first_name, w.last_name)), ''), w.employee_number, w.id::text) AS "employeeName",
        COALESCE(le.code, 'UNKNOWN') AS "legalEntity",
        COALESCE(ou.code, 'UNKNOWN') AS "orgUnit",
        COALESCE(ou.code, 'UNKNOWN') AS department,
        COALESCE(w.manager_id::text, 'UNASSIGNED') AS manager,
        w.status AS "employmentStatus",
        COALESCE(w.hire_date::text, '') AS "hireDate",
        1 AS headcount,
        CASE WHEN w.status = 'ACTIVE' THEN 1 ELSE 0 END AS "activeWorkers",
        CASE WHEN w.hire_date >= (CURRENT_DATE - INTERVAL '90 days') THEN 1 ELSE 0 END AS "newHires",
        0 AS "turnoverRate"
      FROM hr_core.workers w
      LEFT JOIN hr_org.legal_entities le ON le.id = w.legal_entity_id AND le.tenant_id = w.tenant_id
      LEFT JOIN hr_org.org_units ou ON ou.id = w.department_id AND ou.tenant_id = w.tenant_id
      WHERE w.tenant_id = ${tenantId}
      ORDER BY w.updated_at DESC
      LIMIT ${maxRows}
    `.execute(this.db);
    return normalizeRows(result.rows);
  }

  private async loadAttendance(tenantId: string, maxRows: number): Promise<SemanticRow[]> {
    const result = await sql<Record<string, unknown>>`
      SELECT
        l.employee_id AS "employeeNumber",
        l.worker_id::text AS "workerKey",
        l.worker_name AS "employeeName",
        COALESCE(le.code, 'UNKNOWN') AS "legalEntity",
        COALESCE(ou.code, 'UNKNOWN') AS "orgUnit",
        COALESCE(ou.code, 'UNKNOWN') AS department,
        COALESCE(w.manager_id::text, 'UNASSIGNED') AS manager,
        l.status AS "attendanceStatus",
        COALESCE(l.governance->>'policyCode', 'UNASSIGNED') AS "policyCode",
        l.work_date::text AS "workDate",
        1 AS "employeeDays",
        ROUND(l.payable_minutes::numeric / 60, 2) AS "payableHours",
        l.late_minutes AS "lateMinutes",
        ROUND(l.overtime_minutes::numeric / 60, 2) AS "overtimeHours",
        l.exception_count AS exceptions
      FROM hr_time.attendance_daily_ledgers l
      LEFT JOIN hr_core.workers w ON w.id = l.worker_id AND w.tenant_id = l.tenant_id
      LEFT JOIN hr_org.legal_entities le ON le.id = w.legal_entity_id AND le.tenant_id = w.tenant_id
      LEFT JOIN hr_org.org_units ou ON ou.id = w.department_id AND ou.tenant_id = w.tenant_id
      WHERE l.tenant_id = ${tenantId}
      ORDER BY l.work_date DESC, l.updated_at DESC
      LIMIT ${maxRows}
    `.execute(this.db);
    return normalizeRows(result.rows);
  }

  private async loadLeave(tenantId: string, maxRows: number): Promise<SemanticRow[]> {
    const result = await sql<Record<string, unknown>>`
      SELECT
        COALESCE(w.employee_number, r.worker_id::text) AS "employeeNumber",
        r.worker_id::text AS "workerKey",
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', w.first_name, w.last_name)), ''), w.employee_number, r.worker_id::text) AS "employeeName",
        COALESCE(le.code, 'UNKNOWN') AS "legalEntity",
        COALESCE(ou.code, 'UNKNOWN') AS "orgUnit",
        COALESCE(ou.code, 'UNKNOWN') AS department,
        COALESCE(w.manager_id::text, 'UNASSIGNED') AS manager,
        r.absence_type AS "leaveType",
        r.status AS "requestStatus",
        r.start_date::text AS "startDate",
        r.end_date::text AS "endDate",
        CASE WHEN r.approved_by IS NOT NULL THEN 'APPROVED_BY_MANAGER' ELSE 'PENDING_MANAGER' END AS "approvalLevel",
        1 AS "requestCount",
        GREATEST((r.end_date - r.start_date) + 1, 0) AS "requestedDays",
        CASE WHEN r.status IN ('APPROVED', 'APPROVED_BY_MANAGER') THEN GREATEST((r.end_date - r.start_date) + 1, 0) ELSE 0 END AS "approvedDays",
        0 AS "balanceRemaining",
        CASE WHEN r.status IN ('DRAFT', 'SUBMITTED', 'PENDING', 'PENDING_MANAGER_REVIEW') THEN 1 ELSE 0 END AS "openRequests"
      FROM hr_absence.absence_requests r
      LEFT JOIN hr_core.workers w ON w.id = r.worker_id AND w.tenant_id = r.tenant_id
      LEFT JOIN hr_org.legal_entities le ON le.id = w.legal_entity_id AND le.tenant_id = w.tenant_id
      LEFT JOIN hr_org.org_units ou ON ou.id = w.department_id AND ou.tenant_id = w.tenant_id
      WHERE r.tenant_id = ${tenantId}
      ORDER BY r.updated_at DESC
      LIMIT ${maxRows}
    `.execute(this.db);
    return normalizeRows(result.rows);
  }

  private async loadPayroll(tenantId: string, maxRows: number): Promise<SemanticRow[]> {
    const result = await sql<Record<string, unknown>>`
      SELECT
        COALESCE(w.employee_number, l.worker_id::text) AS "employeeNumber",
        l.worker_id::text AS "workerKey",
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', w.first_name, w.last_name)), ''), w.employee_number, l.worker_id::text) AS "employeeName",
        COALESCE(le.code, 'UNKNOWN') AS "legalEntity",
        COALESCE(ou.code, 'UNKNOWN') AS "orgUnit",
        COALESCE(ou.code, 'UNKNOWN') AS department,
        COALESCE(w.manager_id::text, 'UNASSIGNED') AS manager,
        COALESCE(to_char(c.pay_period_start, 'YYYY-MM'), 'UNKNOWN') AS "payPeriod",
        COALESCE(MAX(l.currency), 'UNK') AS currency,
        COALESCE(c.status, MAX(l.status), 'CALCULATED') AS "payrollStatus",
        COALESCE(SUM(CASE WHEN l.line_type IN ('GROSS', 'EARNING', 'ALLOWANCE') THEN l.amount ELSE 0 END), 0) AS "grossPay",
        ABS(COALESCE(SUM(CASE WHEN l.line_type ILIKE '%TAX%' THEN l.amount ELSE 0 END), 0)) AS "taxAmount",
        ABS(COALESCE(SUM(CASE WHEN l.line_type ILIKE '%INSURANCE%' THEN l.amount ELSE 0 END), 0)) AS "insuranceAmount",
        ABS(COALESCE(SUM(CASE WHEN l.line_type IN ('DEDUCTION', 'STATUTORY_DEDUCTION') THEN l.amount ELSE 0 END), 0)) AS "deductionAmount",
        COALESCE(SUM(l.amount), 0) AS "netPay"
      FROM hr_payroll.payroll_result_lines l
      LEFT JOIN hr_payroll.payroll_cycles c ON c.id = l.payroll_cycle_id AND c.tenant_id = l.tenant_id
      LEFT JOIN hr_core.workers w ON w.id = l.worker_id AND w.tenant_id = l.tenant_id
      LEFT JOIN hr_org.legal_entities le ON le.id = w.legal_entity_id AND le.tenant_id = w.tenant_id
      LEFT JOIN hr_org.org_units ou ON ou.id = w.department_id AND ou.tenant_id = w.tenant_id
      WHERE l.tenant_id = ${tenantId}
      GROUP BY l.worker_id, w.employee_number, w.first_name, w.last_name, le.code, ou.code, w.manager_id, c.pay_period_start, c.status
      ORDER BY c.pay_period_start DESC NULLS LAST, l.worker_id
      LIMIT ${maxRows}
    `.execute(this.db);
    return normalizeRows(result.rows);
  }

  private async loadBenefits(tenantId: string, maxRows: number): Promise<SemanticRow[]> {
    const result = await sql<Record<string, unknown>>`
      SELECT
        COALESCE(w.employee_number, e.worker_id::text) AS "employeeNumber",
        e.worker_id::text AS "workerKey",
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', w.first_name, w.last_name)), ''), w.employee_number, e.worker_id::text) AS "employeeName",
        COALESCE(le.code, 'UNKNOWN') AS "legalEntity",
        COALESCE(ou.code, 'UNKNOWN') AS "orgUnit",
        COALESCE(ou.code, 'UNKNOWN') AS department,
        COALESCE(w.manager_id::text, 'UNASSIGNED') AS manager,
        COALESCE(p.program_name, 'Unknown program') AS "programName",
        e.coverage_level AS "coverageLevel",
        e.status AS "enrollmentStatus",
        1 AS enrollments,
        jsonb_array_length(e.dependents) AS "dependentsCovered",
        0 AS "employeeContribution",
        0 AS "employerContribution"
      FROM hr_benefits.benefits_enrollments e
      LEFT JOIN hr_benefits.benefits_programs p ON p.id = e.program_id AND p.tenant_id = e.tenant_id
      LEFT JOIN hr_core.workers w ON w.id = e.worker_id AND w.tenant_id = e.tenant_id
      LEFT JOIN hr_org.legal_entities le ON le.id = w.legal_entity_id AND le.tenant_id = w.tenant_id
      LEFT JOIN hr_org.org_units ou ON ou.id = w.department_id AND ou.tenant_id = w.tenant_id
      WHERE e.tenant_id = ${tenantId}
      ORDER BY e.updated_at DESC
      LIMIT ${maxRows}
    `.execute(this.db);
    return normalizeRows(result.rows);
  }

  private async loadPerformance(tenantId: string, maxRows: number): Promise<SemanticRow[]> {
    const result = await sql<Record<string, unknown>>`
      SELECT
        COALESCE(w.employee_number, r.worker_id::text) AS "employeeNumber",
        r.worker_id::text AS "workerKey",
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', w.first_name, w.last_name)), ''), w.employee_number, r.worker_id::text) AS "employeeName",
        COALESCE(le.code, 'UNKNOWN') AS "legalEntity",
        COALESCE(ou.code, 'UNKNOWN') AS "orgUnit",
        COALESCE(ou.code, 'UNKNOWN') AS department,
        COALESCE(r.manager_id::text, 'UNASSIGNED') AS manager,
        COALESCE(c.name, r.review_cycle_id::text) AS "cycleName",
        r.status AS "reviewStatus",
        CASE
          WHEN COALESCE(r.final_rating, r.calibrated_rating) >= 4 THEN 'EXCEEDS'
          WHEN COALESCE(r.final_rating, r.calibrated_rating) >= 3 THEN 'MEETS'
          WHEN COALESCE(r.final_rating, r.calibrated_rating) IS NULL THEN 'UNRATED'
          ELSE 'BELOW'
        END AS "ratingBand",
        1 AS "reviewCount",
        COALESCE(r.final_rating, r.calibrated_rating, 0) AS "averageRating",
        0 AS "goalProgress",
        0 AS "feedbackResponses",
        CASE WHEN r.status IN ('DRAFT', 'IN_PROGRESS', 'PENDING') THEN 1 ELSE 0 END AS "openReviews"
      FROM hr_performance.performance_reviews r
      LEFT JOIN hr_performance.performance_review_cycles c ON c.id = r.review_cycle_id AND c.tenant_id = r.tenant_id
      LEFT JOIN hr_core.workers w ON w.id = r.worker_id AND w.tenant_id = r.tenant_id
      LEFT JOIN hr_org.legal_entities le ON le.id = w.legal_entity_id AND le.tenant_id = w.tenant_id
      LEFT JOIN hr_org.org_units ou ON ou.id = w.department_id AND ou.tenant_id = w.tenant_id
      WHERE r.tenant_id = ${tenantId}
      ORDER BY r.updated_at DESC
      LIMIT ${maxRows}
    `.execute(this.db);
    return normalizeRows(result.rows);
  }

  private async loadCompliance(tenantId: string, maxRows: number): Promise<SemanticRow[]> {
    const result = await sql<Record<string, unknown>>`
      SELECT
        COALESCE(w.employee_number, a.worker_id::text) AS "employeeNumber",
        a.worker_id::text AS "workerKey",
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', w.first_name, w.last_name)), ''), w.employee_number, a.worker_id::text) AS "employeeName",
        COALESCE(le.code, 'UNKNOWN') AS "legalEntity",
        COALESCE(ou.code, 'UNKNOWN') AS "orgUnit",
        COALESCE(ou.code, 'UNKNOWN') AS department,
        COALESCE(w.manager_id::text, 'UNASSIGNED') AS manager,
        COALESCE(d.title, a.policy_document_id::text) AS "policyCode",
        COALESCE(d.document_type, 'POLICY') AS "documentType",
        a.status AS "acknowledgementStatus",
        COALESCE(a.due_date::date::text, '') AS "dueDate",
        1 AS acknowledgements,
        CASE WHEN a.status <> 'ACKNOWLEDGED' AND a.due_date < now() THEN 1 ELSE 0 END AS "overdueAcknowledgements",
        0 AS "statutoryReports",
        0 AS "legalHolds"
      FROM hr_compliance.policy_acknowledgements a
      LEFT JOIN hr_compliance.policy_documents d ON d.id = a.policy_document_id AND d.tenant_id = a.tenant_id
      LEFT JOIN hr_core.workers w ON w.id = a.worker_id AND w.tenant_id = a.tenant_id
      LEFT JOIN hr_org.legal_entities le ON le.id = w.legal_entity_id AND le.tenant_id = w.tenant_id
      LEFT JOIN hr_org.org_units ou ON ou.id = w.department_id AND ou.tenant_id = w.tenant_id
      WHERE a.tenant_id = ${tenantId}
      ORDER BY a.updated_at DESC
      LIMIT ${maxRows}
    `.execute(this.db);
    return normalizeRows(result.rows);
  }

  private async loadServices(tenantId: string, maxRows: number): Promise<SemanticRow[]> {
    const result = await sql<Record<string, unknown>>`
      SELECT
        c.case_number AS "caseNumber",
        c.case_type AS "serviceName",
        COALESCE(w.employee_number, c.requester_worker_id::text) AS "employeeNumber",
        c.requester_worker_id::text AS "workerKey",
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', w.first_name, w.last_name)), ''), w.employee_number, c.requester_worker_id::text) AS "employeeName",
        COALESCE(le.code, 'UNKNOWN') AS "legalEntity",
        COALESCE(ou.code, 'UNKNOWN') AS "orgUnit",
        COALESCE(ou.code, 'UNKNOWN') AS department,
        COALESCE(w.manager_id::text, 'UNASSIGNED') AS manager,
        c.status AS "caseStatus",
        COALESCE(c.assigned_to::text, 'UNASSIGNED') AS "ownerTeam",
        1 AS cases,
        0 AS "openTasks",
        CASE WHEN c.resolved_at IS NULL AND c.sla_deadline < now() THEN 1 ELSE 0 END AS "slaBreaches",
        COALESCE(EXTRACT(EPOCH FROM (COALESCE(c.resolved_at, now()) - c.created_at)) / 3600, 0) AS "resolutionHours"
      FROM hr_service_delivery.hr_service_cases c
      LEFT JOIN hr_core.workers w ON w.id = c.requester_worker_id AND w.tenant_id = c.tenant_id
      LEFT JOIN hr_org.legal_entities le ON le.id = w.legal_entity_id AND le.tenant_id = w.tenant_id
      LEFT JOIN hr_org.org_units ou ON ou.id = w.department_id AND ou.tenant_id = w.tenant_id
      WHERE c.tenant_id = ${tenantId}
      ORDER BY c.updated_at DESC
      LIMIT ${maxRows}
    `.execute(this.db);
    return normalizeRows(result.rows);
  }

  private async loadAccess(tenantId: string, maxRows: number): Promise<SemanticRow[]> {
    const result = await sql<Record<string, unknown>>`
      SELECT
        COALESCE(i.subject_worker_id::text, i.subject_user_id::text, i.service_account_id::text, 'Unknown subject') AS "principalName",
        COALESCE(i.role_id::text, 'NO_ROLE') AS "roleName",
        COALESCE(i.permission_id::text, 'NO_PERMISSION') AS "permissionName",
        i.decision AS "accessStatus",
        COALESCE(c.status, i.decision) AS "reviewStatus",
        CASE WHEN i.decision IN ('APPROVED', 'CERTIFIED') THEN 1 ELSE 0 END AS "activeGrants",
        0 AS "sodViolations",
        CASE WHEN i.decision = 'PENDING' THEN 1 ELSE 0 END AS "overdueReviews",
        0 AS "expiringCredentials"
      FROM hr_platform.access_review_items i
      LEFT JOIN hr_platform.access_review_campaigns c ON c.id = i.campaign_id AND c.tenant_id = i.tenant_id
      WHERE i.tenant_id = ${tenantId}
      ORDER BY i.created_at DESC
      LIMIT ${maxRows}
    `.execute(this.db);
    return normalizeRows(result.rows);
  }

  private async loadOnboarding(tenantId: string, maxRows: number): Promise<SemanticRow[]> {
    const result = await sql<Record<string, unknown>>`
      SELECT
        COALESCE(w.employee_number, p.worker_id::text) AS "employeeNumber",
        p.worker_id::text AS "workerKey",
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', w.first_name, w.last_name)), ''), w.employee_number, p.worker_id::text) AS "employeeName",
        COALESCE(le.code, 'UNKNOWN') AS "legalEntity",
        COALESCE(ou.code, 'UNKNOWN') AS "orgUnit",
        COALESCE(ou.code, 'UNKNOWN') AS department,
        COALESCE(w.manager_id::text, 'UNASSIGNED') AS manager,
        p.start_date::text AS "joiningDate",
        p.status AS "onboardingStatus",
        p.probation_status AS "probationStatus",
        1 AS "planCount",
        CASE WHEN p.status = 'COMPLETED' THEN 100 ELSE 0 END AS "taskCompletionRate",
        CASE WHEN p.status IN ('DRAFT', 'SCHEDULED', 'IN_PROGRESS') THEN 1 ELSE 0 END AS "pendingTasks",
        CASE WHEN p.probation_status = 'PENDING_REVIEW' THEN 1 ELSE 0 END AS "probationReviewsDue",
        0 AS "timeToProductivityDays",
        CASE WHEN p.status IN ('DRAFT', 'SCHEDULED', 'IN_PROGRESS') THEN 1 ELSE 0 END AS "openPlans"
      FROM hr_onboarding.onboarding_plans p
      LEFT JOIN hr_core.workers w ON w.id = p.worker_id AND w.tenant_id = p.tenant_id
      LEFT JOIN hr_org.legal_entities le ON le.id = w.legal_entity_id AND le.tenant_id = w.tenant_id
      LEFT JOIN hr_org.org_units ou ON ou.id = w.department_id AND ou.tenant_id = w.tenant_id
      WHERE p.tenant_id = ${tenantId}
      ORDER BY p.updated_at DESC
      LIMIT ${maxRows}
    `.execute(this.db);
    return normalizeRows(result.rows);
  }
}

function normalizeRows(rows: Array<Record<string, unknown>>): SemanticRow[] {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]),
  ));
}

function normalizeValue(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const numeric = Number(value);
    return value.trim() !== '' && Number.isFinite(numeric) && !looksLikeIdentifier(value) ? numeric : value;
  }
  if (value === null || value === undefined) return '';
  return String(value);
}

function looksLikeIdentifier(value: string): boolean {
  return /[A-Za-z_-]/.test(value) || /^\d{4}-\d{2}(-\d{2})?/.test(value);
}
