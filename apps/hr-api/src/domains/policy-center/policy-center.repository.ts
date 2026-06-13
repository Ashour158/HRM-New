import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getCurrentTenantId, getPool } from '@hcm/database';
import { sql, type Kysely } from 'kysely';
import type { Database } from '@hcm/database';
import type {
  PolicyApplicationRunRecord,
  PolicyArea,
  PolicyCenterRepositoryPort,
  PolicyCenterSummary,
  PolicyDecisionEvidenceRecord,
  PolicyImpactRecords,
  PolicyImpactResultRecord,
  PolicyImpactSimulationResult,
  PolicyRevisionRecord,
  PolicyScope,
} from './policy-center.types.js';

interface PolicyRevisionRow {
  id: string;
  tenant_id: string;
  area: PolicyArea;
  title: string;
  status: PolicyRevisionRecord['status'];
  baseline_config: unknown;
  draft_config: unknown;
  validation_result: unknown | null;
  simulation_result: unknown | null;
  created_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  published_by: string | null;
  applied_by: string | null;
  review_notes: string | null;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  approved_at: Date | null;
  published_at: Date | null;
  applied_at: Date | null;
  created_at: Date;
  updated_at: Date;
  aggregate_version: number;
  country_codes: unknown;
  legal_entity_ids: unknown;
  org_unit_ids: unknown;
  department_ids: unknown;
  location_codes: unknown;
  branch_codes: unknown;
  job_codes: unknown;
  grade_codes: unknown;
  manager_worker_ids: unknown;
  employee_types: unknown;
  worker_ids: unknown;
  effective_from: string | null;
  effective_until: string | null;
}

interface PolicyApplicationRunRow {
  id: string;
  tenant_id: string;
  revision_id: string;
  status: 'APPLIED' | 'FAILED';
  impacted_employees: number;
  pending_records: unknown;
  applied_by: string;
  applied_at: Date;
  runtime_snapshot: unknown;
}

interface PolicyDecisionEvidenceRow {
  id: string;
  tenant_id: string;
  policy_revision_id: string;
  service_area: PolicyArea;
  engine_name: string;
  engine_version: string;
  scope_match: unknown;
  decision: string;
  reason: string;
  subject_worker_id: string | null;
  source_record_id: string | null;
  created_at: Date;
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function dateIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.toISOString();
}

function json(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function scopeToSqlArray(values: string[] | undefined): string {
  return JSON.stringify(values ?? []);
}

function emptyImpactRecords(): PolicyImpactRecords {
  return {
    workers: [],
    leaveRequests: [],
    attendanceDays: [],
    payrollCycles: [],
    complianceAcknowledgements: [],
    accessGrants: [],
    benefitsEnrollments: [],
    benefitsLifeEvents: [],
  };
}

@Injectable()
export class PolicyCenterRepository implements PolicyCenterRepositoryPort {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async createRevision(record: PolicyRevisionRecord): Promise<PolicyRevisionRecord> {
    await sql`
      INSERT INTO hr_platform.admin_policy_revisions (
        id, tenant_id, area, title, status, baseline_config, draft_config,
        validation_result, simulation_result, created_by, review_notes, aggregate_version,
        created_at, updated_at
      ) VALUES (
        ${record.id}, ${record.tenantId}, ${record.area}, ${record.title}, ${record.status},
        ${json(record.baselineConfig)}::jsonb, ${json(record.draftConfig)}::jsonb,
        ${record.validationResult ? json(record.validationResult) : null}::jsonb,
        ${record.simulationResult ? json(record.simulationResult) : null}::jsonb,
        ${record.createdBy ?? null}, ${record.reviewNotes ?? null}, ${record.aggregateVersion},
        ${record.createdAt}, ${record.updatedAt}
      )
    `.execute(this.db);
    await this.upsertScope(record.id, record.tenantId, record.scope);
    const created = await this.findRevisionById(record.tenantId, record.id);
    return created ?? record;
  }

  async updateRevision(id: string, update: Partial<PolicyRevisionRecord>): Promise<PolicyRevisionRecord> {
    const existing = await sql<PolicyRevisionRow>`
      SELECT revision.*, scope.country_codes, scope.legal_entity_ids, scope.org_unit_ids,
        scope.department_ids, scope.location_codes, scope.branch_codes, scope.job_codes,
        scope.grade_codes, scope.manager_worker_ids, scope.employee_types, scope.worker_ids,
        scope.effective_from::text, scope.effective_until::text
      FROM hr_platform.admin_policy_revisions revision
      LEFT JOIN hr_platform.admin_policy_revision_scopes scope ON scope.revision_id = revision.id
      WHERE revision.id = ${id}
      LIMIT 1
    `.execute(this.db);
    const current = existing.rows[0];
    if (!current) throw new Error(`Policy revision ${id} was not found.`);

    await sql`
      UPDATE hr_platform.admin_policy_revisions
      SET
        area = ${update.area ?? current.area},
        title = ${update.title ?? current.title},
        status = ${update.status ?? current.status},
        baseline_config = ${json(update.baselineConfig ?? current.baseline_config)}::jsonb,
        draft_config = ${json(update.draftConfig ?? current.draft_config)}::jsonb,
        validation_result = ${update.validationResult === undefined ? (current.validation_result ? json(current.validation_result) : null) : (update.validationResult ? json(update.validationResult) : null)}::jsonb,
        simulation_result = ${update.simulationResult === undefined ? (current.simulation_result ? json(current.simulation_result) : null) : (update.simulationResult ? json(update.simulationResult) : null)}::jsonb,
        created_by = ${update.createdBy ?? current.created_by},
        reviewed_by = ${update.reviewedBy ?? current.reviewed_by},
        approved_by = ${update.approvedBy ?? current.approved_by},
        published_by = ${update.publishedBy ?? current.published_by},
        applied_by = ${update.appliedBy ?? current.applied_by},
        review_notes = ${update.reviewNotes ?? current.review_notes},
        submitted_at = ${update.submittedAt ?? current.submitted_at},
        reviewed_at = ${update.reviewedAt ?? current.reviewed_at},
        approved_at = ${update.approvedAt ?? current.approved_at},
        published_at = ${update.publishedAt ?? current.published_at},
        applied_at = ${update.appliedAt ?? current.applied_at},
        aggregate_version = ${update.aggregateVersion ?? current.aggregate_version},
        updated_at = ${update.updatedAt ?? new Date().toISOString()}
      WHERE id = ${id}
    `.execute(this.db);

    if (update.scope) {
      await this.upsertScope(id, current.tenant_id, update.scope);
    }

    const updated = await this.findRevisionById(current.tenant_id, id);
    if (!updated) throw new Error(`Policy revision ${id} was not found after update.`);
    return updated;
  }

  async findRevisionById(tenantId: string, id: string): Promise<PolicyRevisionRecord | undefined> {
    const result = await sql<PolicyRevisionRow>`
      SELECT revision.*, scope.country_codes, scope.legal_entity_ids, scope.org_unit_ids,
        scope.department_ids, scope.location_codes, scope.branch_codes, scope.job_codes,
        scope.grade_codes, scope.manager_worker_ids, scope.employee_types, scope.worker_ids,
        scope.effective_from::text, scope.effective_until::text
      FROM hr_platform.admin_policy_revisions revision
      LEFT JOIN hr_platform.admin_policy_revision_scopes scope ON scope.revision_id = revision.id
      WHERE revision.tenant_id = ${tenantId}
        AND revision.id = ${id}
      LIMIT 1
    `.execute(this.db);
    return result.rows[0] ? this.toRevision(result.rows[0]) : undefined;
  }

  async listRevisions(tenantId: string, area?: PolicyArea): Promise<PolicyRevisionRecord[]> {
    const result = await sql<PolicyRevisionRow>`
      SELECT revision.*, scope.country_codes, scope.legal_entity_ids, scope.org_unit_ids,
        scope.department_ids, scope.location_codes, scope.branch_codes, scope.job_codes,
        scope.grade_codes, scope.manager_worker_ids, scope.employee_types, scope.worker_ids,
        scope.effective_from::text, scope.effective_until::text
      FROM hr_platform.admin_policy_revisions revision
      LEFT JOIN hr_platform.admin_policy_revision_scopes scope ON scope.revision_id = revision.id
      WHERE revision.tenant_id = ${tenantId}
        AND (${area ?? null}::text IS NULL OR revision.area = ${area ?? null})
      ORDER BY revision.updated_at DESC
    `.execute(this.db);
    return result.rows.map((row) => this.toRevision(row));
  }

  async listActiveRevisionsByArea(tenantId: string, area: PolicyArea): Promise<PolicyRevisionRecord[]> {
    const result = await sql<PolicyRevisionRow>`
      SELECT revision.*, scope.country_codes, scope.legal_entity_ids, scope.org_unit_ids,
        scope.department_ids, scope.location_codes, scope.branch_codes, scope.job_codes,
        scope.grade_codes, scope.manager_worker_ids, scope.employee_types, scope.worker_ids,
        scope.effective_from::text, scope.effective_until::text
      FROM hr_platform.admin_policy_revisions revision
      LEFT JOIN hr_platform.admin_policy_revision_scopes scope ON scope.revision_id = revision.id
      WHERE revision.tenant_id = ${tenantId}
        AND revision.area = ${area}
        AND revision.status IN ('PUBLISHED', 'APPLIED')
    `.execute(this.db);
    return result.rows.map((row) => this.toRevision(row));
  }

  async summarizePolicyCenter(tenantId: string): Promise<PolicyCenterSummary> {
    const revisions = await this.listRevisions(tenantId);
    const runs = await sql<PolicyApplicationRunRow>`
      SELECT *
      FROM hr_platform.admin_policy_application_runs
      WHERE tenant_id = ${tenantId}
      ORDER BY applied_at DESC
      LIMIT 8
    `.execute(this.db);

    return {
      totalRevisions: revisions.length,
      byStatus: revisions.reduce<Record<string, number>>((counts, revision) => {
        counts[revision.status] = (counts[revision.status] ?? 0) + 1;
        return counts;
      }, {}),
      byArea: revisions.reduce<Record<string, number>>((counts, revision) => {
        counts[revision.area] = (counts[revision.area] ?? 0) + 1;
        return counts;
      }, {}),
      recentRuns: runs.rows.map((row) => this.toApplicationRun(row)),
    };
  }

  async countImpactedWorkers(tenantId: string, scope: PolicyScope): Promise<{ count: number; workerIds: string[] }> {
    if ((scope.workerIds ?? []).length > 0) {
      return { count: scope.workerIds?.length ?? 0, workerIds: scope.workerIds ?? [] };
    }

    const result = await sql<{ id: string }>`
      SELECT DISTINCT w.id
      FROM hr_core.workers w
      LEFT JOIN hr_org.legal_entities le ON le.id = w.legal_entity_id
      LEFT JOIN hr_core.job_assignments ja ON ja.worker_id = w.id AND ja.tenant_id = w.tenant_id AND ja.end_date IS NULL
      LEFT JOIN hr_position.positions p ON p.id = ja.position_id AND p.tenant_id = w.tenant_id
      LEFT JOIN hr_org.org_units ou ON ou.id = w.department_id AND ou.tenant_id = w.tenant_id
      WHERE w.tenant_id = ${tenantId}
        AND w.status IN ('ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED')
        AND (jsonb_array_length(${scope.orgUnitIds ? scopeToSqlArray(scope.orgUnitIds) : '[]'}::jsonb) = 0 OR ou.id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.orgUnitIds)}::jsonb)))
        AND (jsonb_array_length(${scope.departmentIds ? scopeToSqlArray(scope.departmentIds) : '[]'}::jsonb) = 0 OR w.department_id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.departmentIds)}::jsonb)))
        AND (jsonb_array_length(${scope.legalEntityIds ? scopeToSqlArray(scope.legalEntityIds) : '[]'}::jsonb) = 0 OR w.legal_entity_id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.legalEntityIds)}::jsonb)))
        AND (jsonb_array_length(${scope.employeeTypes ? scopeToSqlArray(scope.employeeTypes) : '[]'}::jsonb) = 0 OR w.employment_type IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.employeeTypes)}::jsonb)))
        AND (jsonb_array_length(${scope.countryCodes ? scopeToSqlArray(scope.countryCodes) : '[]'}::jsonb) = 0 OR le.country_code IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.countryCodes)}::jsonb)))
        AND (jsonb_array_length(${scope.branchCodes ? scopeToSqlArray(scope.branchCodes) : '[]'}::jsonb) = 0 OR ou.code IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.branchCodes)}::jsonb)))
        AND (jsonb_array_length(${scope.jobCodes ? scopeToSqlArray(scope.jobCodes) : '[]'}::jsonb) = 0 OR p.position_code IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.jobCodes)}::jsonb)) OR p.job_family IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.jobCodes)}::jsonb)))
        AND (jsonb_array_length(${scope.gradeCodes ? scopeToSqlArray(scope.gradeCodes) : '[]'}::jsonb) = 0 OR p.job_level IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.gradeCodes)}::jsonb)))
        AND (jsonb_array_length(${scope.managerWorkerIds ? scopeToSqlArray(scope.managerWorkerIds) : '[]'}::jsonb) = 0 OR w.manager_id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.managerWorkerIds)}::jsonb)))
      ORDER BY w.created_at DESC
      LIMIT 250
    `.execute(this.db);
    return { count: result.rows.length, workerIds: result.rows.map((row) => row.id) };
  }

  async countPendingDomainRecords(tenantId: string, _area: PolicyArea, _scope: PolicyScope): Promise<PolicyImpactSimulationResult['pendingRecords']> {
    const pendingLeaveRequests = await this.countPendingLeaveRequests(tenantId);
    const openAttendanceDays = await this.countOpenAttendanceDays(tenantId);
    const openPayrollCycles = await this.countOpenPayrollCycles(tenantId);
    const pendingComplianceAcknowledgements = await this.countPendingComplianceAcknowledgements(tenantId);
    const pendingBenefitsEnrollments = await this.countPendingBenefitsEnrollments(tenantId);
    const pendingBenefitsLifeEvents = await this.countPendingBenefitsLifeEvents(tenantId);

    return { pendingLeaveRequests, openAttendanceDays, openPayrollCycles, pendingComplianceAcknowledgements, pendingBenefitsEnrollments, pendingBenefitsLifeEvents };
  }

  async listImpactRecords(tenantId: string, area: PolicyArea, scope: PolicyScope): Promise<PolicyImpactRecords> {
    const records = emptyImpactRecords();
    records.workers = await this.listImpactedWorkerRecords(tenantId, scope);
    const workerIds = records.workers.map((worker) => worker.workerId);
    records.leaveRequests = area === 'LEAVE' || area === 'PAYROLL' || area === 'ATTENDANCE'
      ? await this.listPendingLeaveImpactRecords(tenantId, workerIds)
      : [];
    records.attendanceDays = area === 'ATTENDANCE' || area === 'PAYROLL'
      ? await this.listOpenAttendanceImpactRecords(tenantId, workerIds)
      : [];
    records.payrollCycles = area === 'PAYROLL' || area === 'LEAVE' || area === 'ATTENDANCE' || area === 'COUNTRY_POLICY'
      ? await this.listOpenPayrollImpactRecords(tenantId)
      : [];
    records.complianceAcknowledgements = area === 'COMPLIANCE' || area === 'COUNTRY_POLICY'
      ? await this.listComplianceAcknowledgementImpactRecords(tenantId, workerIds)
      : [];
    records.benefitsEnrollments = area === 'BENEFITS' || area === 'PAYROLL'
      ? await this.listBenefitsEnrollmentImpactRecords(tenantId, workerIds)
      : [];
    records.benefitsLifeEvents = area === 'BENEFITS'
      ? await this.listBenefitsLifeEventImpactRecords(tenantId, workerIds)
      : [];
    return records;
  }

  async createApplicationRun(record: PolicyApplicationRunRecord): Promise<PolicyApplicationRunRecord> {
    await sql`
      INSERT INTO hr_platform.admin_policy_application_runs (
        id, tenant_id, revision_id, status, impacted_employees, pending_records,
        applied_by, applied_at, runtime_snapshot
      ) VALUES (
        ${record.id}, ${record.tenantId}, ${record.revisionId}, ${record.status},
        ${record.impactedEmployees}, ${json(record.pendingRecords)}::jsonb,
        ${record.appliedBy}, ${record.appliedAt}, ${json(record.runtimeSnapshot)}::jsonb
      )
    `.execute(this.db);
    return record;
  }

  async createImpactResult(record: PolicyImpactResultRecord): Promise<PolicyImpactResultRecord> {
    await sql`
      INSERT INTO hr_platform.admin_policy_impact_results (
        id, tenant_id, revision_id, simulation_result, created_by, created_at
      ) VALUES (
        ${record.id}, ${record.tenantId}, ${record.revisionId},
        ${json(record.simulationResult)}::jsonb, ${record.createdBy}, ${record.createdAt}
      )
    `.execute(this.db);
    return record;
  }

  async createDecisionEvidence(record: PolicyDecisionEvidenceRecord): Promise<PolicyDecisionEvidenceRecord> {
    await sql`
      INSERT INTO hr_platform.admin_policy_decision_evidence (
        id, tenant_id, policy_revision_id, service_area, engine_name, engine_version,
        scope_match, decision, reason, subject_worker_id, source_record_id, created_at
      ) VALUES (
        ${record.id}, ${record.tenantId}, ${record.policyRevisionId}, ${record.serviceArea},
        ${record.engineName}, ${record.engineVersion}, ${json(record.scopeMatch)}::jsonb,
        ${record.decision}, ${record.reason}, ${record.subjectWorkerId ?? null},
        ${record.sourceRecordId ?? null}, ${record.createdAt}
      )
    `.execute(this.db);
    return record;
  }

  async listDecisionEvidence(tenantId: string, limit = 25): Promise<PolicyDecisionEvidenceRecord[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const result = await sql<PolicyDecisionEvidenceRow>`
      SELECT *
      FROM hr_platform.admin_policy_decision_evidence
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${boundedLimit}
    `.execute(this.db);
    return result.rows.map((row) => this.toDecisionEvidence(row));
  }

  private async upsertScope(revisionId: string, tenantId: string, scope: PolicyScope): Promise<void> {
    const contextTenantId = getCurrentTenantId();
    if (!contextTenantId) {
      throw new Error('Policy revision scope writes require tenant context');
    }
    if (contextTenantId.value !== tenantId) {
      throw new Error('Policy revision scope tenant context does not match revision tenant');
    }
    await sql`
      INSERT INTO hr_platform.admin_policy_revision_scopes (
        id, tenant_id, revision_id, country_codes, legal_entity_ids, org_unit_ids,
        department_ids, location_codes, branch_codes, job_codes, grade_codes,
        manager_worker_ids, employee_types, worker_ids, effective_from, effective_until
      ) VALUES (
        gen_random_uuid(), ${contextTenantId.value}, ${revisionId}, ${scopeToSqlArray(scope.countryCodes)}::jsonb,
        ${scopeToSqlArray(scope.legalEntityIds)}::jsonb, ${scopeToSqlArray(scope.orgUnitIds)}::jsonb,
        ${scopeToSqlArray(scope.departmentIds)}::jsonb, ${scopeToSqlArray(scope.locationCodes)}::jsonb,
        ${scopeToSqlArray(scope.branchCodes)}::jsonb, ${scopeToSqlArray(scope.jobCodes)}::jsonb,
        ${scopeToSqlArray(scope.gradeCodes)}::jsonb, ${scopeToSqlArray(scope.managerWorkerIds)}::jsonb,
        ${scopeToSqlArray(scope.employeeTypes)}::jsonb, ${scopeToSqlArray(scope.workerIds)}::jsonb,
        ${scope.effectiveFrom ?? null}, ${scope.effectiveUntil ?? null}
      )
      ON CONFLICT (revision_id)
      DO UPDATE SET
        country_codes = EXCLUDED.country_codes,
        legal_entity_ids = EXCLUDED.legal_entity_ids,
        org_unit_ids = EXCLUDED.org_unit_ids,
        department_ids = EXCLUDED.department_ids,
        location_codes = EXCLUDED.location_codes,
        branch_codes = EXCLUDED.branch_codes,
        job_codes = EXCLUDED.job_codes,
        grade_codes = EXCLUDED.grade_codes,
        manager_worker_ids = EXCLUDED.manager_worker_ids,
        employee_types = EXCLUDED.employee_types,
        worker_ids = EXCLUDED.worker_ids,
        effective_from = EXCLUDED.effective_from,
        effective_until = EXCLUDED.effective_until
    `.execute(this.db);
  }

  private async countPendingLeaveRequests(tenantId: string): Promise<number> {
    try {
      const result = await sql<{ count: number }>`
        SELECT count(*)::int AS count
        FROM hr_absence.absence_requests
        WHERE tenant_id = ${tenantId}
          AND status IN ('DRAFT', 'SUBMITTED', 'PENDING_MANAGER_APPROVAL', 'PENDING_HR_APPROVAL')
      `.execute(this.db);
      return result.rows[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }

  private async countOpenAttendanceDays(tenantId: string): Promise<number> {
    try {
      const result = await sql<{ count: number }>`
        SELECT count(*)::int AS count
        FROM hr_time.attendance_daily_ledgers
        WHERE tenant_id = ${tenantId}
          AND status IN ('OPEN', 'EXCEPTION', 'PENDING_APPROVAL')
      `.execute(this.db);
      return result.rows[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }

  private async countOpenPayrollCycles(tenantId: string): Promise<number> {
    try {
      const result = await sql<{ count: number }>`
        SELECT count(*)::int AS count
        FROM hr_payroll.payroll_cycles
        WHERE tenant_id = ${tenantId}
          AND status IN ('OPEN', 'INPUT_COLLECTION', 'CALCULATING', 'REVIEW')
      `.execute(this.db);
      return result.rows[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }

  private async countPendingComplianceAcknowledgements(tenantId: string): Promise<number> {
    try {
      const result = await sql<{ count: number }>`
        SELECT count(*)::int AS count
        FROM hr_compliance.policy_acknowledgements
        WHERE tenant_id = ${tenantId}
          AND status IN ('PENDING', 'OVERDUE')
      `.execute(this.db);
      return result.rows[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }

  private async countPendingBenefitsEnrollments(tenantId: string): Promise<number> {
    try {
      const result = await sql<{ count: number }>`
        SELECT count(*)::int AS count
        FROM hr_benefits.benefits_enrollments
        WHERE tenant_id = ${tenantId}
          AND status IN ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL')
      `.execute(this.db);
      return result.rows[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }

  private async countPendingBenefitsLifeEvents(tenantId: string): Promise<number> {
    try {
      const result = await sql<{ count: number }>`
        SELECT count(*)::int AS count
        FROM hr_benefits.benefits_life_events
        WHERE tenant_id = ${tenantId}
          AND status IN ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL')
      `.execute(this.db);
      return result.rows[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }

  private async listImpactedWorkerRecords(tenantId: string, scope: PolicyScope): Promise<PolicyImpactRecords['workers']> {
    try {
      const workerIds = scope.workerIds ?? [];
      const result = await sql<{
        id: string;
        employee_number: string | null;
        first_name: string | null;
        last_name: string | null;
        manager_id: string | null;
        department_id: string | null;
        legal_entity_id: string | null;
        country_code: string | null;
      }>`
        SELECT DISTINCT w.id, w.employee_number, w.first_name, w.last_name, w.manager_id,
          w.department_id, w.legal_entity_id, le.country_code
        FROM hr_core.workers w
        LEFT JOIN hr_org.legal_entities le ON le.id = w.legal_entity_id
        LEFT JOIN hr_core.job_assignments ja ON ja.worker_id = w.id AND ja.tenant_id = w.tenant_id AND ja.end_date IS NULL
        LEFT JOIN hr_position.positions p ON p.id = ja.position_id AND p.tenant_id = w.tenant_id
        LEFT JOIN hr_org.org_units ou ON ou.id = w.department_id AND ou.tenant_id = w.tenant_id
        WHERE w.tenant_id = ${tenantId}
          AND w.status IN ('ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED')
          AND (jsonb_array_length(${scopeToSqlArray(workerIds)}::jsonb) = 0 OR w.id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(workerIds)}::jsonb)))
          AND (jsonb_array_length(${scopeToSqlArray(scope.orgUnitIds)}::jsonb) = 0 OR ou.id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.orgUnitIds)}::jsonb)))
          AND (jsonb_array_length(${scopeToSqlArray(scope.departmentIds)}::jsonb) = 0 OR w.department_id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.departmentIds)}::jsonb)))
          AND (jsonb_array_length(${scopeToSqlArray(scope.legalEntityIds)}::jsonb) = 0 OR w.legal_entity_id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.legalEntityIds)}::jsonb)))
          AND (jsonb_array_length(${scopeToSqlArray(scope.employeeTypes)}::jsonb) = 0 OR w.employment_type IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.employeeTypes)}::jsonb)))
          AND (jsonb_array_length(${scopeToSqlArray(scope.countryCodes)}::jsonb) = 0 OR le.country_code IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.countryCodes)}::jsonb)))
          AND (jsonb_array_length(${scopeToSqlArray(scope.branchCodes)}::jsonb) = 0 OR ou.code IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.branchCodes)}::jsonb)))
          AND (jsonb_array_length(${scopeToSqlArray(scope.jobCodes)}::jsonb) = 0 OR p.position_code IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.jobCodes)}::jsonb)) OR p.job_family IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.jobCodes)}::jsonb)))
          AND (jsonb_array_length(${scopeToSqlArray(scope.gradeCodes)}::jsonb) = 0 OR p.job_level IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.gradeCodes)}::jsonb)))
          AND (jsonb_array_length(${scopeToSqlArray(scope.managerWorkerIds)}::jsonb) = 0 OR w.manager_id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(scope.managerWorkerIds)}::jsonb)))
        ORDER BY w.created_at DESC
        LIMIT 250
      `.execute(this.db);
      return result.rows.map((row) => ({
        workerId: row.id,
        employeeNumber: row.employee_number ?? undefined,
        displayName: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.employee_number || row.id,
        managerWorkerId: row.manager_id ?? undefined,
        departmentId: row.department_id ?? undefined,
        legalEntityId: row.legal_entity_id ?? undefined,
        countryCode: row.country_code ?? undefined,
        beforeDecision: 'Uses currently applied runtime policy.',
        afterDecision: 'Will be re-evaluated using this policy revision when it is applied.',
        risk: 'SAFE',
      }));
    } catch {
      return [];
    }
  }

  private async listPendingLeaveImpactRecords(tenantId: string, workerIds: string[]): Promise<PolicyImpactRecords['leaveRequests']> {
    try {
      const result = await sql<{ id: string; worker_id: string; status: string }>`
        SELECT id, worker_id, status
        FROM hr_absence.absence_requests
        WHERE tenant_id = ${tenantId}
          AND status IN ('DRAFT', 'SUBMITTED', 'PENDING_MANAGER_APPROVAL', 'PENDING_HR_APPROVAL')
          AND (jsonb_array_length(${scopeToSqlArray(workerIds)}::jsonb) = 0 OR worker_id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(workerIds)}::jsonb)))
        ORDER BY updated_at DESC
        LIMIT 100
      `.execute(this.db);
      return result.rows.map((row) => ({
        recordId: row.id,
        workerId: row.worker_id,
        status: row.status,
        beforeDecision: 'Pending leave request follows current policy evidence.',
        afterDecision: 'Pending leave request will be revalidated after policy apply.',
        risk: 'WARNING',
      }));
    } catch {
      return [];
    }
  }

  private async listOpenAttendanceImpactRecords(tenantId: string, workerIds: string[]): Promise<PolicyImpactRecords['attendanceDays']> {
    try {
      const result = await sql<{ id: string; worker_id: string; status: string }>`
        SELECT id, worker_id, status
        FROM hr_time.attendance_daily_ledgers
        WHERE tenant_id = ${tenantId}
          AND status IN ('OPEN', 'EXCEPTION', 'PENDING_APPROVAL')
          AND locked = false
          AND (jsonb_array_length(${scopeToSqlArray(workerIds)}::jsonb) = 0 OR worker_id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(workerIds)}::jsonb)))
        ORDER BY work_date DESC
        LIMIT 100
      `.execute(this.db);
      return result.rows.map((row) => ({
        recordId: row.id,
        workerId: row.worker_id,
        status: row.status,
        beforeDecision: 'Open attendance day follows current attendance policy.',
        afterDecision: 'Open attendance day may need recalculation before payroll.',
        risk: 'WARNING',
      }));
    } catch {
      return [];
    }
  }

  private async listOpenPayrollImpactRecords(tenantId: string): Promise<PolicyImpactRecords['payrollCycles']> {
    try {
      const result = await sql<{ id: string; status: string }>`
        SELECT id, status
        FROM hr_payroll.payroll_cycles
        WHERE tenant_id = ${tenantId}
          AND status IN ('OPEN', 'INPUT_COLLECTION', 'CALCULATING', 'REVIEW')
        ORDER BY updated_at DESC
        LIMIT 100
      `.execute(this.db);
      return result.rows.map((row) => ({
        recordId: row.id,
        status: row.status,
        beforeDecision: 'Open payroll cycle uses current payroll policy.',
        afterDecision: 'Open payroll cycle must be revalidated before close.',
        risk: 'BLOCKED',
      }));
    } catch {
      return [];
    }
  }

  private async listComplianceAcknowledgementImpactRecords(tenantId: string, workerIds: string[]): Promise<PolicyImpactRecords['complianceAcknowledgements']> {
    try {
      const result = await sql<{ id: string; worker_id: string; status: string }>`
        SELECT id, worker_id, status
        FROM hr_compliance.policy_acknowledgements
        WHERE tenant_id = ${tenantId}
          AND status IN ('PENDING', 'OVERDUE')
          AND (jsonb_array_length(${scopeToSqlArray(workerIds)}::jsonb) = 0 OR worker_id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(workerIds)}::jsonb)))
        ORDER BY due_date ASC NULLS LAST
        LIMIT 100
      `.execute(this.db);
      return result.rows.map((row) => ({
        recordId: row.id,
        workerId: row.worker_id,
        status: row.status,
        beforeDecision: 'Acknowledgement follows current compliance policy.',
        afterDecision: 'Acknowledgement may be regenerated or re-notified after apply.',
        risk: 'WARNING',
      }));
    } catch {
      return [];
    }
  }

  private async listBenefitsEnrollmentImpactRecords(tenantId: string, workerIds: string[]): Promise<PolicyImpactRecords['benefitsEnrollments']> {
    try {
      const result = await sql<{ id: string; worker_id: string; status: string }>`
        SELECT id, worker_id, status
        FROM hr_benefits.benefits_enrollments
        WHERE tenant_id = ${tenantId}
          AND status IN ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL')
          AND (jsonb_array_length(${scopeToSqlArray(workerIds)}::jsonb) = 0 OR worker_id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(workerIds)}::jsonb)))
        ORDER BY updated_at DESC
        LIMIT 100
      `.execute(this.db);
      return result.rows.map((row) => ({
        recordId: row.id,
        workerId: row.worker_id,
        status: row.status,
        beforeDecision: 'Enrollment follows current benefits policy.',
        afterDecision: 'Enrollment may need revalidation after benefits policy apply.',
        risk: 'WARNING',
      }));
    } catch {
      return [];
    }
  }

  private async listBenefitsLifeEventImpactRecords(tenantId: string, workerIds: string[]): Promise<PolicyImpactRecords['benefitsLifeEvents']> {
    try {
      const result = await sql<{ id: string; worker_id: string; status: string }>`
        SELECT id, worker_id, status
        FROM hr_benefits.benefits_life_events
        WHERE tenant_id = ${tenantId}
          AND status IN ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL')
          AND (jsonb_array_length(${scopeToSqlArray(workerIds)}::jsonb) = 0 OR worker_id::text IN (SELECT jsonb_array_elements_text(${scopeToSqlArray(workerIds)}::jsonb)))
        ORDER BY updated_at DESC
        LIMIT 100
      `.execute(this.db);
      return result.rows.map((row) => ({
        recordId: row.id,
        workerId: row.worker_id,
        status: row.status,
        beforeDecision: 'Life event follows current benefits policy.',
        afterDecision: 'Life event may need revalidation after benefits policy apply.',
        risk: 'WARNING',
      }));
    } catch {
      return [];
    }
  }

  private toRevision(row: PolicyRevisionRow): PolicyRevisionRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      area: row.area,
      title: row.title,
      status: row.status,
      baselineConfig: row.baseline_config as Record<string, unknown>,
      draftConfig: row.draft_config as Record<string, unknown>,
      scope: {
        tenantId: row.tenant_id,
        countryCodes: asArray(row.country_codes),
        legalEntityIds: asArray(row.legal_entity_ids),
        orgUnitIds: asArray(row.org_unit_ids),
        departmentIds: asArray(row.department_ids),
        locationCodes: asArray(row.location_codes),
        branchCodes: asArray(row.branch_codes),
        jobCodes: asArray(row.job_codes),
        gradeCodes: asArray(row.grade_codes),
        managerWorkerIds: asArray(row.manager_worker_ids),
        employeeTypes: asArray(row.employee_types),
        workerIds: asArray(row.worker_ids),
        effectiveFrom: row.effective_from ?? undefined,
        effectiveUntil: row.effective_until ?? undefined,
      },
      validationResult: row.validation_result as PolicyRevisionRecord['validationResult'] | undefined,
      simulationResult: row.simulation_result as PolicyRevisionRecord['simulationResult'] | undefined,
      createdBy: row.created_by ?? undefined,
      reviewedBy: row.reviewed_by ?? undefined,
      approvedBy: row.approved_by ?? undefined,
      publishedBy: row.published_by ?? undefined,
      appliedBy: row.applied_by ?? undefined,
      reviewNotes: row.review_notes ?? undefined,
      submittedAt: dateIso(row.submitted_at),
      reviewedAt: dateIso(row.reviewed_at),
      approvedAt: dateIso(row.approved_at),
      publishedAt: dateIso(row.published_at),
      appliedAt: dateIso(row.applied_at),
      createdAt: dateIso(row.created_at) ?? new Date().toISOString(),
      updatedAt: dateIso(row.updated_at) ?? new Date().toISOString(),
      aggregateVersion: Number(row.aggregate_version ?? 0),
    };
  }

  private toApplicationRun(row: PolicyApplicationRunRow): PolicyApplicationRunRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      revisionId: row.revision_id,
      status: row.status,
      impactedEmployees: row.impacted_employees,
      pendingRecords: row.pending_records as PolicyApplicationRunRecord['pendingRecords'],
      appliedBy: row.applied_by,
      appliedAt: dateIso(row.applied_at) ?? new Date().toISOString(),
      runtimeSnapshot: row.runtime_snapshot as PolicyApplicationRunRecord['runtimeSnapshot'],
    };
  }

  private toDecisionEvidence(row: PolicyDecisionEvidenceRow): PolicyDecisionEvidenceRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      policyRevisionId: row.policy_revision_id,
      serviceArea: row.service_area,
      engineName: row.engine_name,
      engineVersion: row.engine_version,
      scopeMatch: row.scope_match as PolicyScope,
      decision: row.decision,
      reason: row.reason,
      subjectWorkerId: row.subject_worker_id ?? undefined,
      sourceRecordId: row.source_record_id ?? undefined,
      createdAt: dateIso(row.created_at) ?? new Date().toISOString(),
    };
  }
}
