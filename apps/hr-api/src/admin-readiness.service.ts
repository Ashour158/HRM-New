import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { sql } from 'kysely';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { HcmSetupService } from './domains/hcm-setup/hcm-setup.service.js';
import type { HcmSetupConfig, RuntimePolicyArea } from './domains/hcm-setup/hcm-setup.types.js';
import { IntegrationHealthService } from './integrations/integration-health.service.js';
import { loadAppConfig } from './config/app.config.js';

export type ProductionReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'NOT_CONFIGURED';

export interface ProductionReadinessDomain {
  code: string;
  label: string;
  status: ProductionReadinessStatus;
  summary: string;
  blockers: string[];
  warnings: string[];
  evidence: string[];
  metrics: Record<string, number | string | boolean>;
  actionPath: string;
}

export interface ProductionReadinessSnapshot {
  tenantId: string;
  generatedAt: string;
  overallStatus: ProductionReadinessStatus;
  overallScore: number;
  productionReady: boolean;
  summary: Record<ProductionReadinessStatus, number>;
  domains: ProductionReadinessDomain[];
  criticalBlockers: string[];
  warnings: string[];
}

export type ProductionPendingWorkGroup =
  | 'Setup And People'
  | 'Policy And Payroll'
  | 'Governance And Privacy'
  | 'Operational Health'
  | 'Release Gates';

export interface ProductionPendingWorkItem {
  id: string;
  group: ProductionPendingWorkGroup;
  title: string;
  summary: string;
  count: number;
  status: 'live' | 'partial' | 'not-configured' | 'attention';
  statusLabel: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionPath: string;
  actionLabel: string;
  signals: string[];
}

export interface ProductionPendingWorkSnapshot {
  tenantId: string;
  generatedAt: string;
  totalOpenItems: number;
  highPriorityItems: number;
  items: ProductionPendingWorkItem[];
  groups: Array<{
    group: ProductionPendingWorkGroup;
    openItems: number;
    highestPriority: ProductionPendingWorkItem['priority'];
  }>;
}

interface CountRow {
  count: string | number | bigint;
}

interface AreaCountRow {
  area: string;
  count: string | number | bigint;
}

export function determineReadinessStatus(input: {
  configured: boolean;
  blockers?: readonly string[];
  warnings?: readonly string[];
}): ProductionReadinessStatus {
  if ((input.blockers ?? []).length > 0) return 'BLOCKED';
  if (!input.configured) return 'NOT_CONFIGURED';
  if ((input.warnings ?? []).length > 0) return 'WARNING';
  return 'READY';
}

export function summarizeProductionReadiness(domains: ProductionReadinessDomain[]): {
  overallStatus: ProductionReadinessStatus;
  overallScore: number;
  productionReady: boolean;
  summary: Record<ProductionReadinessStatus, number>;
  criticalBlockers: string[];
  warnings: string[];
} {
  const summary: Record<ProductionReadinessStatus, number> = {
    READY: 0,
    WARNING: 0,
    BLOCKED: 0,
    NOT_CONFIGURED: 0,
  };
  let score = 0;

  for (const domain of domains) {
    summary[domain.status] += 1;
    score += domain.status === 'READY'
      ? 100
      : domain.status === 'WARNING'
        ? 70
        : domain.status === 'NOT_CONFIGURED'
          ? 35
          : 0;
  }

  const criticalBlockers = domains.flatMap((domain) =>
    domain.blockers.map((blocker) => `${domain.label}: ${blocker}`),
  );
  const warnings = domains.flatMap((domain) =>
    domain.warnings.map((warning) => `${domain.label}: ${warning}`),
  );
  const overallScore = domains.length > 0 ? Math.round(score / domains.length) : 0;
  const productionReady = summary.BLOCKED === 0 && summary.NOT_CONFIGURED === 0 && summary.WARNING === 0;
  const overallStatus: ProductionReadinessStatus = summary.BLOCKED > 0
    ? 'BLOCKED'
    : summary.NOT_CONFIGURED > 0
      ? 'NOT_CONFIGURED'
      : summary.WARNING > 0
        ? 'WARNING'
        : 'READY';

  return { overallStatus, overallScore, productionReady, summary, criticalBlockers, warnings };
}

export function summarizeProductionPendingWork(items: ProductionPendingWorkItem[]): Pick<ProductionPendingWorkSnapshot, 'totalOpenItems' | 'highPriorityItems' | 'groups'> {
  const totalOpenItems = items.reduce((sum, item) => sum + (item.status === 'live' ? 0 : Math.max(item.count, 1)), 0);
  const highPriorityItems = items.filter((item) => item.priority === 'HIGH' || item.priority === 'CRITICAL').length;
  const priorityRank: Record<ProductionPendingWorkItem['priority'], number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };
  const groups = Array.from(
    items.reduce((map, item) => {
      const current = map.get(item.group);
      const openContribution = item.status === 'live' ? 0 : Math.max(item.count, 1);
      if (!current) {
        map.set(item.group, {
          group: item.group,
          openItems: openContribution,
          highestPriority: item.priority,
        });
        return map;
      }
      current.openItems += openContribution;
      if (priorityRank[item.priority] > priorityRank[current.highestPriority]) {
        current.highestPriority = item.priority;
      }
      return map;
    }, new Map<ProductionPendingWorkGroup, ProductionPendingWorkSnapshot['groups'][number]>()),
    ([, value]) => value,
  );
  return { totalOpenItems, highPriorityItems, groups };
}

function countValue(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function activeCount<T extends { active?: boolean }>(items: T[] | undefined): number {
  return (items ?? []).filter((item) => item.active).length;
}

function anyPolicyLedger(setup: HcmSetupConfig): boolean {
  return Boolean(
    setup.leavePolicies.some((policy) =>
      (policy.accrualRules?.length ?? 0) > 0 ||
      (policy.periodLimits?.length ?? 0) > 0 ||
      (policy.approvalRules?.length ?? 0) > 0,
    ) ||
    (setup.attendancePolicy.ruleLedger?.length ?? 0) > 0 ||
    setup.earningPolicies.some((policy) => (policy.calculationLedger?.length ?? 0) > 0 || policy.logicLedger) ||
    setup.deductionPolicies.some((policy) => (policy.calculationLedger?.length ?? 0) > 0 || policy.logicLedger) ||
    (setup.benefitsPolicyRuntime?.eligibilityRules?.length ?? 0) > 0 ||
    (setup.policyGovernance?.actionRuleLedgers?.length ?? 0) > 0
  );
}

function areaCounts(rows: AreaCountRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.area, countValue(row.count)]));
}

function hasRepoFile(relativePath: string): boolean {
  let cwd = process.cwd();
  for (let i = 0; i < 5; i += 1) {
    if (existsSync(resolve(cwd, relativePath))) return true;
    const parent = dirname(cwd);
    if (parent === cwd) break;
    cwd = parent;
  }
  return false;
}

@Injectable()
export class AdminReadinessService {
  private readonly db = createKyselyInstance(getPool());

  constructor(
    private readonly hcmSetup: HcmSetupService,
    private readonly integrationHealth: IntegrationHealthService,
  ) {}

  async getReadiness(tenantId: Uuid): Promise<ProductionReadinessSnapshot> {
    const [setup, counts, appliedPolicyRows, queueCounts] = await Promise.all([
      this.hcmSetup.getSetup(tenantId),
      this.loadCounts(tenantId.value),
      this.appliedPolicyCounts(tenantId.value),
      this.loadQueueCounts(tenantId.value),
    ]);

    const appliedPolicies = areaCounts(appliedPolicyRows);
    const domains = this.buildDomains({
      setup,
      counts,
      appliedPolicies,
      queueCounts,
    });
    const summary = summarizeProductionReadiness(domains);

    return {
      tenantId: tenantId.value,
      generatedAt: new Date().toISOString(),
      ...summary,
      domains,
    };
  }

  async getPendingWork(tenantId: Uuid): Promise<ProductionPendingWorkSnapshot> {
    const [setup, counts, appliedPolicyRows, queueCounts] = await Promise.all([
      this.hcmSetup.getSetup(tenantId),
      this.loadCounts(tenantId.value),
      this.appliedPolicyCounts(tenantId.value),
      this.loadQueueCounts(tenantId.value),
    ]);
    const items = this.buildPendingWork({
      setup,
      counts,
      appliedPolicies: areaCounts(appliedPolicyRows),
      queueCounts,
    });
    return {
      tenantId: tenantId.value,
      generatedAt: new Date().toISOString(),
      items,
      ...summarizeProductionPendingWork(items),
    };
  }

  private domain(input: {
    code: string;
    label: string;
    configured: boolean;
    summary: string;
    blockers?: string[];
    warnings?: string[];
    evidence: string[];
    metrics?: Record<string, number | string | boolean>;
    actionPath: string;
  }): ProductionReadinessDomain {
    return {
      code: input.code,
      label: input.label,
      status: determineReadinessStatus(input),
      summary: input.summary,
      blockers: input.blockers ?? [],
      warnings: input.warnings ?? [],
      evidence: input.evidence,
      metrics: input.metrics ?? {},
      actionPath: input.actionPath,
    };
  }

  private buildDomains(input: {
    setup: HcmSetupConfig;
    counts: Awaited<ReturnType<AdminReadinessService['loadCounts']>>;
    appliedPolicies: Record<string, number>;
    queueCounts: Awaited<ReturnType<AdminReadinessService['loadQueueCounts']>>;
  }): ProductionReadinessDomain[] {
    const { setup, counts, appliedPolicies, queueCounts } = input;
    const config = loadAppConfig();
    const runtimePolicyAreas = new Set((setup.runtimePolicyRevisions ?? []).map((revision) => revision.area));
    const requiredPolicyAreas: RuntimePolicyArea[] = [
      'LEAVE',
      'ATTENDANCE',
      'PAYROLL',
      'ACCESS_GOVERNANCE',
      'COMPLIANCE',
      'BENEFITS',
    ];
    const missingPolicyAreas = requiredPolicyAreas.filter((area) =>
      (appliedPolicies[area] ?? 0) === 0 && !runtimePolicyAreas.has(area),
    );
    const integrationReadiness = this.integrationHealth.getAllReadiness();
    const integrationBlockers = integrationReadiness.flatMap((entry) =>
      entry.blockers.map((blocker) => `${entry.adapterName}: ${blocker}`),
    );
    const ciFiles = {
      ci: hasRepoFile('.github/workflows/ci.yml'),
      release: hasRepoFile('.github/workflows/release.yml'),
      apiDocker: hasRepoFile('apps/hr-api/Dockerfile'),
      webDocker: hasRepoFile('apps/hr-web/Dockerfile'),
      k8s: hasRepoFile('deploy/k8s/base/kustomization.yaml'),
    };
    const observabilityFiles = {
      metricsEndpoint: hasRepoFile('apps/hr-api/src/observability/observability.controller.ts'),
      metricsTests: hasRepoFile('apps/hr-api/src/observability/observability-metrics.service.spec.ts'),
      tracingConfig: hasRepoFile('apps/hr-api/src/observability/opentelemetry.ts'),
      alertRules: hasRepoFile('deploy/observability/prometheus-rules.yaml'),
      runbook: hasRepoFile('docs/observability-runbook.md'),
    };
    const complianceRetentionRules = setup.compliancePolicyRuntime?.retentionRules?.length ?? 0;
    const complianceLegalHoldRules = setup.compliancePolicyRuntime?.legalHoldRules?.length ?? 0;

    return [
      this.domain({
        code: 'AUTH',
        label: 'Auth, Sessions, RBAC',
        configured: counts.roles > 0 && counts.permissions > 0,
        summary: 'Verified actor context, roles, permissions, MFA, and enterprise identity readiness.',
        blockers: [
          counts.roles === 0 ? 'No roles are configured for the tenant.' : null,
          counts.permissions === 0 ? 'No permissions are configured for the tenant.' : null,
        ].filter(Boolean) as string[],
        warnings: [
          config.nodeEnv !== 'production' ? 'Runtime is not production mode.' : null,
          config.mfaRequired ? null : 'MFA step-up is not required by runtime config.',
          config.oidcIssuerUrl || config.samlMetadataUrl ? null : 'Enterprise SSO is not configured.',
          config.mfaDemoCode ? 'Demo MFA code is enabled outside production.' : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.roles} roles and ${counts.permissions} permissions are stored.`,
          `MFA required: ${config.mfaRequired ? 'yes' : 'no'}.`,
          `SSO configured: ${config.oidcIssuerUrl || config.samlMetadataUrl ? 'yes' : 'no'}.`,
        ],
        metrics: { roles: counts.roles, permissions: counts.permissions },
        actionPath: '/admin/system-console/access-governance',
      }),
      this.domain({
        code: 'TENANT',
        label: 'Tenant And Setup',
        configured: counts.activeTenants > 0 && counts.hcmSetupConfigs > 0,
        summary: 'Tenant record, setup snapshot, and company operating defaults.',
        blockers: [
          counts.activeTenants === 0 ? 'No active tenant was found.' : null,
          counts.hcmSetupConfigs === 0 ? 'No persisted HCM setup snapshot exists.' : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.activeTenants} active tenant(s).`,
          `${counts.hcmSetupConfigs} setup snapshot(s).`,
          `${activeCount(setup.departments)} active departments and ${activeCount(setup.locations)} active locations.`,
        ],
        metrics: { activeTenants: counts.activeTenants, setupSnapshots: counts.hcmSetupConfigs },
        actionPath: '/admin/system-console/settings',
      }),
      this.domain({
        code: 'CORE_HR',
        label: 'Core HR And Employee Master Data',
        configured: counts.activeWorkers > 0,
        summary: 'Worker master data, assignments, managers, and employee lifecycle source of truth.',
        blockers: [counts.activeWorkers === 0 ? 'No active workers exist.' : null].filter(Boolean) as string[],
        warnings: [
          counts.workersMissingDepartment > 0 ? `${counts.workersMissingDepartment} active worker(s) have no department.` : null,
          counts.workersMissingManager > 0 ? `${counts.workersMissingManager} active worker(s) have no manager.` : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.activeWorkers} active worker(s).`,
          `${counts.employmentContracts} employment contract record(s).`,
          `${counts.personalDataRecords} personal data record(s).`,
        ],
        metrics: {
          activeWorkers: counts.activeWorkers,
          missingDepartment: counts.workersMissingDepartment,
          missingManager: counts.workersMissingManager,
        },
        actionPath: '/admin/employees',
      }),
      this.domain({
        code: 'ORGANIZATION',
        label: 'Organization And Workforce Structure',
        configured: counts.legalEntities > 0 && counts.orgUnits > 0,
        summary: 'Legal entities, org units, positions, hierarchy, and planning structure.',
        blockers: [
          counts.legalEntities === 0 ? 'No legal entities are configured.' : null,
          counts.orgUnits === 0 ? 'No org units are configured.' : null,
        ].filter(Boolean) as string[],
        warnings: [
          counts.managerRelationships === 0 ? 'No manager relationship records exist.' : null,
          counts.positions === 0 ? 'No positions exist for workforce planning.' : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.legalEntities} legal entity record(s).`,
          `${counts.orgUnits} org unit record(s).`,
          `${counts.positions} position record(s).`,
        ],
        metrics: {
          legalEntities: counts.legalEntities,
          orgUnits: counts.orgUnits,
          managerRelationships: counts.managerRelationships,
          positions: counts.positions,
        },
        actionPath: '/admin/organization',
      }),
      this.domain({
        code: 'POLICIES',
        label: 'Policy Center Control Brain',
        configured: (setup.runtimePolicyRevisions?.length ?? 0) > 0 || Object.values(appliedPolicies).some((count) => count > 0),
        summary: 'Applied policy revisions, rule ledgers, runtime snapshot, and decision evidence.',
        blockers: [
          missingPolicyAreas.length > 0 ? `Missing applied/runtime policies: ${missingPolicyAreas.join(', ')}.` : null,
          anyPolicyLedger(setup) ? null : 'No deep policy rule ledger is configured in runtime setup.',
        ].filter(Boolean) as string[],
        warnings: [
          counts.policyDecisionEvidence === 0 ? 'No policy decision evidence has been written yet.' : null,
          counts.policyImpactResults === 0 ? 'No exact policy impact simulation results are stored yet.' : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${Object.values(appliedPolicies).reduce((sum, value) => sum + value, 0)} applied policy revision(s).`,
          `${setup.runtimePolicyRevisions?.length ?? 0} runtime policy revision snapshot(s).`,
          `${counts.policyDecisionEvidence} policy decision evidence record(s).`,
        ],
        metrics: {
          appliedRevisions: Object.values(appliedPolicies).reduce((sum, value) => sum + value, 0),
          decisionEvidence: counts.policyDecisionEvidence,
          impactResults: counts.policyImpactResults,
        },
        actionPath: '/admin/system-console/policies',
      }),
      this.domain({
        code: 'WORKFLOWS',
        label: 'Workflow And Approval Engine',
        configured: counts.transitionLedgers > 0,
        summary: 'Approval transitions, command state changes, and governed workflow evidence.',
        blockers: [counts.transitionLedgers === 0 ? 'No workflow transition ledger entries exist.' : null].filter(Boolean) as string[],
        warnings: [
          counts.pendingAccessReviews > 0 ? `${counts.pendingAccessReviews} access review item(s) are still pending.` : null,
          counts.pendingAttendanceCorrections > 0 ? `${counts.pendingAttendanceCorrections} attendance correction(s) are still pending.` : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.transitionLedgers} workflow transition(s).`,
          `${counts.pendingAccessReviews} pending access review item(s).`,
          `${counts.pendingAttendanceCorrections} pending attendance correction(s).`,
        ],
        metrics: {
          transitionLedgers: counts.transitionLedgers,
          pendingAccessReviews: counts.pendingAccessReviews,
          pendingAttendanceCorrections: counts.pendingAttendanceCorrections,
        },
        actionPath: '/admin/system-console/access-governance',
      }),
      this.domain({
        code: 'ATTENDANCE',
        label: 'Attendance, Scheduling, And Ledger',
        configured: Boolean(setup.attendancePolicy) && counts.timeClockEvents > 0 && counts.attendanceDailyLedgers > 0,
        summary: 'Check-in/out evidence, geofence/device policy, daily ledger, exceptions, and payroll handoff.',
        blockers: [
          counts.timeClockEvents === 0 ? 'No check-in/out time clock events exist.' : null,
          counts.attendanceDailyLedgers === 0 ? 'No attendance daily ledger rows exist.' : null,
        ].filter(Boolean) as string[],
        warnings: [
          setup.attendancePolicy.geofenceEnabled ? null : 'Attendance geofence policy is disabled.',
          counts.attendanceExceptions > 0 ? `${counts.attendanceExceptions} unresolved attendance exception(s).` : null,
          counts.attendanceLedgerNotReady > 0 ? `${counts.attendanceLedgerNotReady} attendance ledger row(s) are not payroll-ready.` : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.timeClockEvents} time clock event(s).`,
          `${counts.attendanceDailyLedgers} daily ledger row(s).`,
          `${counts.attendanceLedgerReady} payroll-ready attendance ledger row(s).`,
        ],
        metrics: {
          timeClockEvents: counts.timeClockEvents,
          dailyLedgers: counts.attendanceDailyLedgers,
          payrollReadyRows: counts.attendanceLedgerReady,
          exceptions: counts.attendanceExceptions,
        },
        actionPath: '/admin/attendance',
      }),
      this.domain({
        code: 'LEAVE',
        label: 'Leave Management',
        configured: activeCount(setup.leavePolicies) > 0 && counts.absenceRequests > 0,
        summary: 'Leave policies, request workflow, balances, accrual, attendance bridge, and payroll impact.',
        blockers: [
          activeCount(setup.leavePolicies) === 0 ? 'No active leave policy is configured.' : null,
          counts.absenceRequests === 0 ? 'No leave/absence request records exist.' : null,
        ].filter(Boolean) as string[],
        warnings: [
          counts.absenceAccrualBalances === 0 ? 'No leave balance ledger records exist.' : null,
          counts.pendingAbsenceRequests > 0 ? `${counts.pendingAbsenceRequests} leave request(s) are still pending.` : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${activeCount(setup.leavePolicies)} active leave polic(ies).`,
          `${counts.absenceRequests} absence request(s).`,
          `${counts.absenceAccrualBalances} balance ledger record(s).`,
        ],
        metrics: {
          activeLeavePolicies: activeCount(setup.leavePolicies),
          absenceRequests: counts.absenceRequests,
          balances: counts.absenceAccrualBalances,
        },
        actionPath: '/admin/leave',
      }),
      this.domain({
        code: 'PAYROLL',
        label: 'Payroll Trust Layer',
        configured: counts.payrollCycles > 0 && activeCount(setup.statutoryPayrollPacks) > 0,
        summary: 'Statutory packs, salary composition, calculation rows, close blockers, payslips, GL, and bank batch.',
        blockers: [
          activeCount(setup.statutoryPayrollPacks) === 0 ? 'No active statutory payroll pack is configured.' : null,
          counts.payrollCycles === 0 ? 'No payroll cycle exists.' : null,
          counts.payrollResultLines === 0 ? 'No payroll result lines exist.' : null,
        ].filter(Boolean) as string[],
        warnings: [
          activeCount(setup.salaryCompositionPlans) === 0 ? 'No active salary composition plan is configured.' : null,
          counts.payrollPaymentBatches === 0 ? 'No payroll payment batch has been generated.' : null,
          counts.payrollPayslips === 0 ? 'No payslip artifact has been generated.' : null,
          counts.payrollGlPostings === 0 ? 'No GL posting preview has been generated.' : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${activeCount(setup.statutoryPayrollPacks)} active statutory pack(s).`,
          `${counts.payrollCycles} payroll cycle(s).`,
          `${counts.payrollResultLines} payroll result line(s).`,
        ],
        metrics: {
          cycles: counts.payrollCycles,
          resultLines: counts.payrollResultLines,
          payslips: counts.payrollPayslips,
          paymentBatches: counts.payrollPaymentBatches,
          glPostings: counts.payrollGlPostings,
        },
        actionPath: '/admin/payroll',
      }),
      this.domain({
        code: 'BENEFITS',
        label: 'Benefits Lifecycle',
        configured: counts.benefitsPrograms > 0 && counts.benefitsEnrollments > 0,
        summary: 'Programs, eligibility, enrollment, life events, carrier reconciliation, and payroll contribution bridge.',
        blockers: [
          counts.benefitsPrograms === 0 ? 'No benefits programs exist.' : null,
          counts.benefitsEnrollments === 0 ? 'No benefits enrollment records exist.' : null,
        ].filter(Boolean) as string[],
        warnings: [
          counts.benefitsLifeEvents === 0 ? 'No benefits life event workflow records exist.' : null,
          counts.carrierReconciliationRuns === 0 ? 'No carrier reconciliation run exists.' : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.benefitsPrograms} benefits program(s).`,
          `${counts.benefitsEnrollments} enrollment record(s).`,
          `${counts.carrierReconciliationRuns} carrier reconciliation run(s).`,
        ],
        metrics: {
          programs: counts.benefitsPrograms,
          enrollments: counts.benefitsEnrollments,
          lifeEvents: counts.benefitsLifeEvents,
        },
        actionPath: '/admin/modules/benefits/operations',
      }),
      this.domain({
        code: 'PERFORMANCE',
        label: 'Performance And 360',
        configured: counts.performanceReviewCycles > 0 && counts.performanceReviews > 0,
        summary: 'Review cycles, 360 responses, goals, manager/team projections, and privacy suppression.',
        blockers: [
          counts.performanceReviewCycles === 0 ? 'No performance review cycles exist.' : null,
          counts.performanceReviews === 0 ? 'No performance review records exist.' : null,
        ].filter(Boolean) as string[],
        warnings: [
          counts.feedback360Responses === 0 ? 'No 360 feedback responses exist yet.' : null,
          counts.developmentPlans === 0 ? 'No development plan projection records exist yet.' : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.performanceReviewCycles} review cycle(s).`,
          `${counts.performanceReviews} review record(s).`,
          `${counts.feedback360Responses} 360 feedback response(s).`,
        ],
        metrics: {
          reviewCycles: counts.performanceReviewCycles,
          reviews: counts.performanceReviews,
          feedback360Responses: counts.feedback360Responses,
        },
        actionPath: '/admin/performance',
      }),
      this.domain({
        code: 'REPORTING',
        label: 'Reporting And BI',
        configured: counts.reportDefinitions > 0,
        summary: 'Traditional reports, smart BI definitions, executions, schedules, semantic data, and governance.',
        blockers: [counts.reportDefinitions === 0 ? 'No report definitions exist.' : null].filter(Boolean) as string[],
        warnings: [
          counts.reportExecutions === 0 ? 'No saved report execution has been run.' : null,
          counts.reportSchedules === 0 ? 'No report subscriptions/schedules exist.' : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.reportDefinitions} report definition(s).`,
          `${counts.reportExecutions} report execution(s).`,
          `${counts.calculatedFields} calculated field(s).`,
        ],
        metrics: {
          definitions: counts.reportDefinitions,
          executions: counts.reportExecutions,
          schedules: counts.reportSchedules,
        },
        actionPath: '/admin/reports',
      }),
      this.domain({
        code: 'ACCESS_GOVERNANCE',
        label: 'Access Governance',
        configured: counts.roles > 0 && counts.serviceAccounts > 0 && counts.serviceAccountCredentials > 0,
        summary: 'RBAC, ABAC, service accounts, access reviews, SoD rules, and privileged access readiness.',
        blockers: [
          counts.roles === 0 ? 'No roles are configured.' : null,
          counts.serviceAccounts === 0 ? 'No governed service accounts exist.' : null,
          counts.serviceAccounts > 0 && counts.serviceAccountCredentials === 0 ? 'Service accounts have no governed credential records.' : null,
        ].filter(Boolean) as string[],
        warnings: [
          counts.accessReviewCampaigns === 0 ? 'No access review campaign exists.' : null,
          counts.sodRules === 0 ? 'No segregation-of-duties rule exists.' : null,
          counts.accessReviewOverdueCampaigns > 0 ? `${counts.accessReviewOverdueCampaigns} access review campaign(s) are overdue.` : null,
          counts.expiringServiceAccountCredentials > 0 ? `${counts.expiringServiceAccountCredentials} service account credential(s) expire within 14 days or are already expired.` : null,
          counts.accessReviewWorkflowEvents === 0 ? 'Access review reminders, escalations, or completion events have not been recorded.' : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.roles} roles and ${counts.permissions} permissions.`,
          `${counts.serviceAccounts} service account(s).`,
          `${counts.serviceAccountCredentials} service account credential record(s).`,
          `${counts.accessReviewCampaigns} access review campaign(s).`,
        ],
        metrics: {
          serviceAccounts: counts.serviceAccounts,
          serviceAccountCredentials: counts.serviceAccountCredentials,
          accessReviewCampaigns: counts.accessReviewCampaigns,
          overdueCampaigns: counts.accessReviewOverdueCampaigns,
          sodRules: counts.sodRules,
        },
        actionPath: '/admin/system-console/access-governance',
      }),
      this.domain({
        code: 'DATA_GOVERNANCE',
        label: 'Data Governance And Privacy',
        configured: counts.fieldAccessPolicies > 0 && complianceRetentionRules > 0,
        summary: 'Sensitive field controls, privacy notices, retention, legal holds, acknowledgements, and evidence exports.',
        blockers: [
          counts.fieldAccessPolicies === 0 ? 'No field access policy records exist.' : null,
          complianceRetentionRules === 0 ? 'No compliance retention rule is configured.' : null,
        ].filter(Boolean) as string[],
        warnings: [
          activeCount(setup.documentRequirements) === 0 ? 'No active document requirement is configured.' : null,
          activeCount(setup.fieldRules) === 0 ? 'No active employee field catalog rule is configured.' : null,
          complianceLegalHoldRules === 0 ? 'No legal-hold rule is configured.' : null,
          counts.activeLegalHolds > 0 ? `${counts.activeLegalHolds} legal hold(s) are active.` : null,
          counts.overduePolicyAcknowledgements > 0 ? `${counts.overduePolicyAcknowledgements} policy acknowledgement(s) are overdue.` : null,
          counts.auditWithoutRetentionClass > 0 ? `${counts.auditWithoutRetentionClass} audit record(s) have no retention class evidence.` : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${activeCount(setup.fieldRules)} active employee field rule(s).`,
          `${activeCount(setup.documentRequirements)} active document requirement(s).`,
          `${counts.fieldAccessPolicies} field access policy record(s).`,
          `${counts.policyDocuments} compliance policy document(s).`,
        ],
        metrics: {
          fieldCatalogRules: activeCount(setup.fieldRules),
          documentRequirements: activeCount(setup.documentRequirements),
          activeLegalHolds: counts.activeLegalHolds,
          overdueAcknowledgements: counts.overduePolicyAcknowledgements,
          auditWithoutRetentionClass: counts.auditWithoutRetentionClass,
        },
        actionPath: '/admin/system-console/settings',
      }),
      this.domain({
        code: 'INTEGRATIONS',
        label: 'Integrations',
        configured: integrationReadiness.length > 0,
        summary: 'Provider credentials, sandbox/production separation, health, retries, incidents, and audit hooks.',
        blockers: integrationBlockers,
        evidence: [
          `${integrationReadiness.length} integration provider(s) registered.`,
          `${integrationReadiness.filter((entry) => entry.ready).length} provider(s) ready.`,
          `${integrationBlockers.length} provider blocker(s).`,
        ],
        metrics: {
          providers: integrationReadiness.length,
          readyProviders: integrationReadiness.filter((entry) => entry.ready).length,
          blockers: integrationBlockers.length,
        },
        actionPath: '/admin/system-console/integrations',
      }),
      this.domain({
        code: 'AUDIT',
        label: 'Audit, Data Governance, And Evidence',
        configured: counts.auditLog > 0 && counts.platformNotifications > 0,
        summary: 'Audit history, notifications, field controls, compliance evidence, and operator traceability.',
        blockers: [counts.auditLog === 0 ? 'No audit log records exist.' : null].filter(Boolean) as string[],
        warnings: [
          counts.platformNotifications === 0 ? 'No platform notification projections exist.' : null,
          counts.fieldAccessPolicies === 0 ? 'No field access policy records exist.' : null,
          counts.auditWithoutRetentionClass > 0 ? `${counts.auditWithoutRetentionClass} audit record(s) are missing retention class evidence.` : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.auditLog} audit log record(s).`,
          `${counts.platformNotifications} notification projection(s).`,
          `${counts.fieldAccessPolicies} field access policy record(s).`,
        ],
        metrics: {
          auditRecords: counts.auditLog,
          notifications: counts.platformNotifications,
          fieldAccessPolicies: counts.fieldAccessPolicies,
          auditWithoutRetentionClass: counts.auditWithoutRetentionClass,
        },
        actionPath: '/admin/system-console/audit',
      }),
      this.domain({
        code: 'QUEUES',
        label: 'Queues And Event Delivery',
        configured: counts.outboxEvents > 0 || counts.inboxEvents > 0,
        summary: 'Transactional outbox, inbox processing, recovery queue, retries, and dead-letter operations.',
        blockers: [
          queueCounts.outboxExhausted > 0 ? `${queueCounts.outboxExhausted} outbox event(s) are exhausted.` : null,
          queueCounts.inboxFailedNonRetryable > 0 ? `${queueCounts.inboxFailedNonRetryable} inbox event(s) failed non-retryably.` : null,
        ].filter(Boolean) as string[],
        warnings: [
          queueCounts.outboxPending > 0 ? `${queueCounts.outboxPending} outbox event(s) are pending.` : null,
          queueCounts.inboxFailedRetryable > 0 ? `${queueCounts.inboxFailedRetryable} inbox event(s) need retry.` : null,
          queueCounts.inboxInProgress > 0 ? `${queueCounts.inboxInProgress} inbox event(s) are in progress.` : null,
        ].filter(Boolean) as string[],
        evidence: [
          `${counts.outboxEvents} outbox event(s).`,
          `${counts.inboxEvents} inbox event(s).`,
          `${queueCounts.outboxPending + queueCounts.inboxFailedRetryable + queueCounts.inboxFailedNonRetryable} queue item(s) need attention.`,
        ],
        metrics: {
          outboxPending: queueCounts.outboxPending,
          outboxExhausted: queueCounts.outboxExhausted,
          inboxFailedRetryable: queueCounts.inboxFailedRetryable,
          inboxFailedNonRetryable: queueCounts.inboxFailedNonRetryable,
        },
        actionPath: '/admin/system-console/dead-letter-events',
      }),
      this.domain({
        code: 'OBSERVABILITY',
        label: 'Observability And Operations',
        configured: Object.values(observabilityFiles).every(Boolean),
        summary: 'Structured logs, metrics, tracing, alert rules, and operator runbooks for production support.',
        blockers: [
          observabilityFiles.metricsEndpoint ? null : 'Metrics endpoint is missing.',
          observabilityFiles.tracingConfig ? null : 'OpenTelemetry tracing configuration is missing.',
          observabilityFiles.alertRules ? null : 'Prometheus alert rules are missing.',
          observabilityFiles.runbook ? null : 'Observability runbook is missing.',
        ].filter(Boolean) as string[],
        warnings: [
          queueCounts.outboxPending + queueCounts.inboxFailedRetryable + queueCounts.inboxFailedNonRetryable > 0
            ? 'Queue health has unresolved backlog or failures.'
            : null,
        ].filter(Boolean) as string[],
        evidence: [
          `Metrics endpoint: ${observabilityFiles.metricsEndpoint ? 'present' : 'missing'}.`,
          `Tracing config: ${observabilityFiles.tracingConfig ? 'present' : 'missing'}.`,
          `Alert rules: ${observabilityFiles.alertRules ? 'present' : 'missing'}.`,
          `Runbook: ${observabilityFiles.runbook ? 'present' : 'missing'}.`,
        ],
        metrics: observabilityFiles,
        actionPath: '/admin/system-console#system-operations',
      }),
      this.domain({
        code: 'CICD',
        label: 'CI/CD, Deployment, And Release',
        configured: Object.values(ciFiles).every(Boolean),
        summary: 'Quality gates, migration verification, container builds, release workflow, and deployment manifests.',
        blockers: [
          ciFiles.ci ? null : 'CI workflow is missing.',
          ciFiles.release ? null : 'Release workflow is missing.',
          ciFiles.apiDocker && ciFiles.webDocker ? null : 'Application Dockerfiles are missing.',
          ciFiles.k8s ? null : 'Kubernetes deployment base is missing.',
        ].filter(Boolean) as string[],
        warnings: ['Runtime cannot prove the latest CI run passed; use GitHub checks as the authoritative gate.'],
        evidence: [
          `CI workflow file: ${ciFiles.ci ? 'present' : 'missing'}.`,
          `Release workflow file: ${ciFiles.release ? 'present' : 'missing'}.`,
          `Kubernetes base: ${ciFiles.k8s ? 'present' : 'missing'}.`,
        ],
        metrics: ciFiles,
        actionPath: '/admin/system-console/readiness',
      }),
    ];
  }

  private buildPendingWork(input: {
    setup: HcmSetupConfig;
    counts: Awaited<ReturnType<AdminReadinessService['loadCounts']>>;
    appliedPolicies: Record<string, number>;
    queueCounts: Awaited<ReturnType<AdminReadinessService['loadQueueCounts']>>;
  }): ProductionPendingWorkItem[] {
    const { setup, counts, appliedPolicies, queueCounts } = input;
    const requiredPolicyAreas: RuntimePolicyArea[] = ['LEAVE', 'ATTENDANCE', 'PAYROLL', 'ACCESS_GOVERNANCE', 'COMPLIANCE', 'BENEFITS'];
    const runtimePolicyAreas = new Set((setup.runtimePolicyRevisions ?? []).map((revision) => revision.area));
    const missingPolicyAreas = requiredPolicyAreas.filter((area) =>
      (appliedPolicies[area] ?? 0) === 0 && !runtimePolicyAreas.has(area),
    );
    const integrationReadiness = this.integrationHealth.getAllReadiness();
    const integrationBlockerCount = integrationReadiness.reduce((sum, entry) => sum + entry.blockers.length, 0);
    const config = loadAppConfig();
    const ciReady = hasRepoFile('.github/workflows/ci.yml')
      && hasRepoFile('.github/workflows/release.yml')
      && hasRepoFile('apps/hr-api/Dockerfile')
      && hasRepoFile('apps/hr-web/Dockerfile')
      && hasRepoFile('deploy/k8s/base/kustomization.yaml');
    const observabilityReady = hasRepoFile('apps/hr-api/src/observability/observability.controller.ts')
      && hasRepoFile('deploy/observability/prometheus-rules.yaml')
      && hasRepoFile('docs/observability-runbook.md');
    const setupGapCount = [
      activeCount(setup.departments) === 0,
      activeCount(setup.locations) === 0,
      activeCount(setup.fieldRules) === 0,
      activeCount(setup.documentRequirements) === 0,
      counts.workersMissingDepartment > 0,
      counts.workersMissingManager > 0,
    ].filter(Boolean).length;
    const queueDecisionCount = queueCounts.outboxExhausted + queueCounts.inboxFailedNonRetryable;
    const queueWatchCount = queueCounts.outboxPending + queueCounts.inboxFailedRetryable + queueCounts.inboxInProgress;
    const dataGovernanceCount = [
      counts.fieldAccessPolicies === 0,
      (setup.compliancePolicyRuntime?.retentionRules?.length ?? 0) === 0,
      (setup.compliancePolicyRuntime?.legalHoldRules?.length ?? 0) === 0,
      counts.overduePolicyAcknowledgements > 0,
      counts.auditWithoutRetentionClass > 0,
    ].filter(Boolean).length;
    const accessGovernanceCount = [
      counts.serviceAccounts === 0,
      counts.serviceAccounts > 0 && counts.serviceAccountCredentials === 0,
      counts.accessReviewCampaigns === 0,
      counts.accessReviewOverdueCampaigns > 0,
      counts.sodRules === 0,
      counts.expiringServiceAccountCredentials > 0,
    ].filter(Boolean).length;

    const item = (inputItem: ProductionPendingWorkItem): ProductionPendingWorkItem => inputItem;
    return [
      item({
        id: 'policy-missing-runtime-areas',
        group: 'Policy And Payroll',
        title: 'Apply Required Runtime Policies',
        summary: missingPolicyAreas.length > 0
          ? `Missing applied policy coverage for ${missingPolicyAreas.join(', ')}.`
          : 'Required runtime policies are applied or present in the runtime snapshot.',
        count: missingPolicyAreas.length,
        status: missingPolicyAreas.length > 0 ? 'attention' : 'live',
        statusLabel: missingPolicyAreas.length > 0 ? 'Apply' : 'Clear',
        priority: missingPolicyAreas.length > 0 ? 'CRITICAL' : 'LOW',
        actionPath: '/admin/system-console/policies',
        actionLabel: 'Open Policy Center',
        signals: [
          `${Object.values(appliedPolicies).reduce((sum, value) => sum + value, 0)} applied policy revision(s).`,
          `${setup.runtimePolicyRevisions?.length ?? 0} runtime policy snapshot(s).`,
        ],
      }),
      item({
        id: 'access-certification-and-credentials',
        group: 'Governance And Privacy',
        title: 'Access Certification And Credentials',
        summary: accessGovernanceCount > 0
          ? 'Access reviews, SoD, service account credentials, or credential expiry need administrator action.'
          : 'Access certification, SoD, and service account credentials are covered.',
        count: accessGovernanceCount,
        status: accessGovernanceCount > 0 ? 'attention' : 'live',
        statusLabel: accessGovernanceCount > 0 ? 'Review' : 'Clear',
        priority: accessGovernanceCount > 0 ? 'HIGH' : 'LOW',
        actionPath: '/admin/system-console/access-governance',
        actionLabel: 'Open Access Governance',
        signals: [
          `${counts.accessReviewCampaigns} access review campaign(s), ${counts.pendingAccessReviews} pending item(s).`,
          `${counts.serviceAccountCredentials} service credential record(s), ${counts.expiringServiceAccountCredentials} expiring soon.`,
          `${counts.sodRules} SoD rule(s).`,
        ],
      }),
      item({
        id: 'data-governance-privacy-controls',
        group: 'Governance And Privacy',
        title: 'Data Governance And Privacy Controls',
        summary: dataGovernanceCount > 0
          ? 'Field controls, retention, legal hold, acknowledgements, or audit retention evidence need work.'
          : 'Field controls, retention, legal hold, acknowledgements, and audit evidence are covered.',
        count: dataGovernanceCount,
        status: dataGovernanceCount > 0 ? 'attention' : 'live',
        statusLabel: dataGovernanceCount > 0 ? 'Fix' : 'Clear',
        priority: dataGovernanceCount > 0 ? 'HIGH' : 'LOW',
        actionPath: '/admin/system-console/settings',
        actionLabel: 'Open Data Rules',
        signals: [
          `${counts.fieldAccessPolicies} field access polic(ies).`,
          `${counts.activeLegalHolds} active legal hold(s).`,
          `${counts.overduePolicyAcknowledgements} overdue acknowledgement(s).`,
        ],
      }),
      item({
        id: 'setup-and-master-data-quality',
        group: 'Setup And People',
        title: 'Setup And Master Data Quality',
        summary: setupGapCount > 0
          ? 'Core setup or worker assignment data is incomplete.'
          : 'Departments, locations, documents, fields, and worker assignments are configured.',
        count: setupGapCount + counts.workersMissingDepartment + counts.workersMissingManager,
        status: setupGapCount > 0 ? 'attention' : 'live',
        statusLabel: setupGapCount > 0 ? 'Fix setup' : 'Ready',
        priority: setupGapCount > 0 ? 'HIGH' : 'LOW',
        actionPath: '/admin/system-console/settings',
        actionLabel: 'Open Setup',
        signals: [
          `${activeCount(setup.departments)} active department(s), ${activeCount(setup.locations)} active location(s).`,
          `${counts.workersMissingDepartment} worker(s) missing department.`,
          `${counts.workersMissingManager} worker(s) missing manager.`,
        ],
      }),
      item({
        id: 'queue-operator-decisions',
        group: 'Operational Health',
        title: 'Failed Work Decisions',
        summary: queueDecisionCount > 0
          ? `${queueDecisionCount} exhausted or non-retryable queue item(s) require inspect, retry, skip, or export.`
          : 'No exhausted or non-retryable queue item needs an operator decision.',
        count: queueDecisionCount,
        status: queueDecisionCount > 0 ? 'attention' : 'live',
        statusLabel: queueDecisionCount > 0 ? 'Inspect' : 'Clear',
        priority: queueDecisionCount > 0 ? 'CRITICAL' : 'LOW',
        actionPath: '/admin/system-console/dead-letter-events',
        actionLabel: 'Open Failed Work',
        signals: [
          `${queueCounts.outboxExhausted} exhausted outbox event(s).`,
          `${queueCounts.inboxFailedNonRetryable} non-retryable inbox event(s).`,
        ],
      }),
      item({
        id: 'queue-backlog-watch',
        group: 'Operational Health',
        title: 'Recovery Queue Backlog',
        summary: queueWatchCount > 0
          ? `${queueWatchCount} pending, retryable, or in-progress event(s) need monitoring.`
          : 'Outbox and inbox recovery backlog is clear.',
        count: queueWatchCount,
        status: queueWatchCount > 0 ? 'attention' : 'live',
        statusLabel: queueWatchCount > 0 ? 'Watch' : 'Clear',
        priority: queueWatchCount > 0 ? 'MEDIUM' : 'LOW',
        actionPath: '/admin/system-console#system-operations',
        actionLabel: 'Review Operations',
        signals: [
          `${queueCounts.outboxPending} pending outbox event(s).`,
          `${queueCounts.inboxFailedRetryable} retryable inbox failure(s).`,
          `${queueCounts.inboxInProgress} in-progress inbox event(s).`,
        ],
      }),
      item({
        id: 'integration-and-mail-readiness',
        group: 'Operational Health',
        title: 'Integration And Mail Readiness',
        summary: integrationBlockerCount > 0
          ? `${integrationBlockerCount} integration readiness blocker(s) need owner action.`
          : 'Registered integrations report no readiness blockers.',
        count: integrationBlockerCount,
        status: integrationBlockerCount > 0 ? 'attention' : integrationReadiness.length > 0 ? 'live' : 'not-configured',
        statusLabel: integrationBlockerCount > 0 ? 'Configure' : integrationReadiness.length > 0 ? 'Ready' : 'Setup',
        priority: integrationBlockerCount > 0 ? 'HIGH' : 'LOW',
        actionPath: '/admin/system-console/integrations',
        actionLabel: 'Open Integrations',
        signals: [
          `${integrationReadiness.length} provider(s) registered.`,
          `${integrationReadiness.filter((entry) => entry.ready).length} provider(s) ready.`,
        ],
      }),
      item({
        id: 'observability-runbook-and-alerts',
        group: 'Operational Health',
        title: 'Observability Runbook And Alerts',
        summary: observabilityReady
          ? 'Metrics endpoint, alert rules, and operator runbook are present.'
          : 'Metrics, alerting, or runbook assets are missing from the release envelope.',
        count: observabilityReady ? 0 : 1,
        status: observabilityReady ? 'live' : 'attention',
        statusLabel: observabilityReady ? 'Ready' : 'Fix',
        priority: observabilityReady ? 'LOW' : 'HIGH',
        actionPath: '/admin/system-console#system-operations',
        actionLabel: 'Open Operations',
        signals: [
          `Production mode: ${config.nodeEnv === 'production' ? 'yes' : 'no'}.`,
          `MFA required: ${config.mfaRequired ? 'yes' : 'no'}.`,
        ],
      }),
      item({
        id: 'release-envelope-gates',
        group: 'Release Gates',
        title: 'CI/CD And Deployment Envelope',
        summary: ciReady
          ? 'CI, release, Docker, and Kubernetes deployment files are present.'
          : 'Release workflow, Docker image, or Kubernetes deployment assets are missing.',
        count: ciReady ? 0 : 1,
        status: ciReady ? 'live' : 'attention',
        statusLabel: ciReady ? 'Ready' : 'Fix',
        priority: ciReady ? 'LOW' : 'CRITICAL',
        actionPath: '/admin/system-console/readiness',
        actionLabel: 'Open Readiness Gate',
        signals: [
          `CI workflow: ${hasRepoFile('.github/workflows/ci.yml') ? 'present' : 'missing'}.`,
          `Release workflow: ${hasRepoFile('.github/workflows/release.yml') ? 'present' : 'missing'}.`,
          `Kubernetes base: ${hasRepoFile('deploy/k8s/base/kustomization.yaml') ? 'present' : 'missing'}.`,
        ],
      }),
    ];
  }

  private async loadCounts(tenantId: string) {
    const rows = await Promise.all([
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.tenants WHERE id = ${tenantId} AND status = 'ACTIVE'`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.hcm_setup_configs WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.roles WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.permissions WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.service_accounts WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.service_account_credentials WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.service_account_credentials WHERE tenant_id = ${tenantId} AND status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= now() + interval '14 days'`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.access_review_campaigns WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.access_review_campaigns WHERE tenant_id = ${tenantId} AND status NOT IN ('COMPLETED', 'CANCELLED') AND due_at IS NOT NULL AND due_at < now()`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.access_review_items WHERE tenant_id = ${tenantId} AND decision IN ('PENDING', 'ESCALATE')`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.access_review_workflow_events WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.sod_rules WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.field_access_policies WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_core.workers WHERE tenant_id = ${tenantId} AND status IN ('ACTIVE', 'REHIRED')`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_core.workers WHERE tenant_id = ${tenantId} AND status IN ('ACTIVE', 'REHIRED') AND department_id IS NULL`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_core.workers WHERE tenant_id = ${tenantId} AND status IN ('ACTIVE', 'REHIRED') AND manager_id IS NULL`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_core.employment_contracts WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_core.personal_data_records WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_org.legal_entities WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_org.org_units WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_org.manager_relationships WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_position.positions WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.admin_policy_decision_evidence WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.admin_policy_impact_results WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.transition_ledgers WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_time.time_clock_events WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_time.attendance_daily_ledgers WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_time.attendance_daily_ledgers WHERE tenant_id = ${tenantId} AND ready_for_payroll = true`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_time.attendance_daily_ledgers WHERE tenant_id = ${tenantId} AND ready_for_payroll = false`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_time.attendance_exceptions WHERE tenant_id = ${tenantId} AND status NOT IN ('RESOLVED', 'CLOSED')`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_time.attendance_correction_requests WHERE tenant_id = ${tenantId} AND status IN ('REQUESTED', 'SUBMITTED', 'PENDING')`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_absence.absence_requests WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_absence.absence_requests WHERE tenant_id = ${tenantId} AND status IN ('SUBMITTED', 'PENDING', 'PENDING_APPROVAL')`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_absence.absence_accrual_balances WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_payroll.payroll_cycles WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_payroll.payroll_result_lines WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_payroll.payroll_payment_batches WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_payroll.payroll_payslip_artifacts WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_payroll.payroll_gl_postings WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_benefits.benefits_programs WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_benefits.benefits_enrollments WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_benefits.benefits_life_events WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_benefits.carrier_reconciliation_runs WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_performance.performance_review_cycles WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_performance.performance_reviews WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_performance.performance_feedback_360_responses WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_performance.development_plans WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_reporting.report_definitions WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_reporting.report_executions WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_reporting.report_schedules WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_reporting.calculated_fields WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.audit_log WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.audit_log WHERE tenant_id = ${tenantId} AND retention_class IS NULL`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.platform_notifications WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.outbox_events WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.inbox_events WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_compliance.policy_documents WHERE tenant_id = ${tenantId}`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_compliance.policy_acknowledgements WHERE tenant_id = ${tenantId} AND status IN ('PENDING', 'OVERDUE')`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_compliance.policy_acknowledgements WHERE tenant_id = ${tenantId} AND status IN ('PENDING', 'OVERDUE') AND due_date IS NOT NULL AND due_date < now()`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_compliance.legal_holds WHERE tenant_id = ${tenantId} AND status = 'ACTIVE'`),
    ]);

    const [
      activeTenants,
      hcmSetupConfigs,
      roles,
      permissions,
      serviceAccounts,
      serviceAccountCredentials,
      expiringServiceAccountCredentials,
      accessReviewCampaigns,
      accessReviewOverdueCampaigns,
      pendingAccessReviews,
      accessReviewWorkflowEvents,
      sodRules,
      fieldAccessPolicies,
      activeWorkers,
      workersMissingDepartment,
      workersMissingManager,
      employmentContracts,
      personalDataRecords,
      legalEntities,
      orgUnits,
      managerRelationships,
      positions,
      policyDecisionEvidence,
      policyImpactResults,
      transitionLedgers,
      timeClockEvents,
      attendanceDailyLedgers,
      attendanceLedgerReady,
      attendanceLedgerNotReady,
      attendanceExceptions,
      pendingAttendanceCorrections,
      absenceRequests,
      pendingAbsenceRequests,
      absenceAccrualBalances,
      payrollCycles,
      payrollResultLines,
      payrollPaymentBatches,
      payrollPayslips,
      payrollGlPostings,
      benefitsPrograms,
      benefitsEnrollments,
      benefitsLifeEvents,
      carrierReconciliationRuns,
      performanceReviewCycles,
      performanceReviews,
      feedback360Responses,
      developmentPlans,
      reportDefinitions,
      reportExecutions,
      reportSchedules,
      calculatedFields,
      auditLog,
      auditWithoutRetentionClass,
      platformNotifications,
      outboxEvents,
      inboxEvents,
      policyDocuments,
      pendingPolicyAcknowledgements,
      overduePolicyAcknowledgements,
      activeLegalHolds,
    ] = rows;

    return {
      activeTenants,
      hcmSetupConfigs,
      roles,
      permissions,
      serviceAccounts,
      serviceAccountCredentials,
      expiringServiceAccountCredentials,
      accessReviewCampaigns,
      accessReviewOverdueCampaigns,
      pendingAccessReviews,
      accessReviewWorkflowEvents,
      sodRules,
      fieldAccessPolicies,
      activeWorkers,
      workersMissingDepartment,
      workersMissingManager,
      employmentContracts,
      personalDataRecords,
      legalEntities,
      orgUnits,
      managerRelationships,
      positions,
      policyDecisionEvidence,
      policyImpactResults,
      transitionLedgers,
      timeClockEvents,
      attendanceDailyLedgers,
      attendanceLedgerReady,
      attendanceLedgerNotReady,
      attendanceExceptions,
      pendingAttendanceCorrections,
      absenceRequests,
      pendingAbsenceRequests,
      absenceAccrualBalances,
      payrollCycles,
      payrollResultLines,
      payrollPaymentBatches,
      payrollPayslips,
      payrollGlPostings,
      benefitsPrograms,
      benefitsEnrollments,
      benefitsLifeEvents,
      carrierReconciliationRuns,
      performanceReviewCycles,
      performanceReviews,
      feedback360Responses,
      developmentPlans,
      reportDefinitions,
      reportExecutions,
      reportSchedules,
      calculatedFields,
      auditLog,
      auditWithoutRetentionClass,
      platformNotifications,
      outboxEvents,
      inboxEvents,
      policyDocuments,
      pendingPolicyAcknowledgements,
      overduePolicyAcknowledgements,
      activeLegalHolds,
    };
  }

  private async appliedPolicyCounts(tenantId: string): Promise<AreaCountRow[]> {
    const result = await sql<AreaCountRow>`
      SELECT area, COUNT(*)::int AS count
      FROM hr_platform.admin_policy_revisions
      WHERE tenant_id = ${tenantId}
        AND status = 'APPLIED'
      GROUP BY area
    `.execute(this.db);
    return result.rows;
  }

  private async loadQueueCounts(tenantId: string) {
    const [
      outboxPending,
      outboxExhausted,
      inboxInProgress,
      inboxFailedRetryable,
      inboxFailedNonRetryable,
      inboxSkipped,
    ] = await Promise.all([
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.outbox_events WHERE tenant_id = ${tenantId} AND published_at IS NULL AND publish_attempt_count < 5`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.outbox_events WHERE tenant_id = ${tenantId} AND published_at IS NULL AND publish_attempt_count >= 5`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.inbox_events WHERE tenant_id = ${tenantId} AND processing_status = 'IN_PROGRESS'`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.inbox_events WHERE tenant_id = ${tenantId} AND processing_status = 'FAILED_RETRYABLE'`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.inbox_events WHERE tenant_id = ${tenantId} AND processing_status = 'FAILED_NON_RETRYABLE'`),
      this.count(sql<CountRow>`SELECT COUNT(*)::int AS count FROM hr_platform.inbox_events WHERE tenant_id = ${tenantId} AND processing_status = 'SKIPPED'`),
    ]);

    return {
      outboxPending,
      outboxExhausted,
      inboxInProgress,
      inboxFailedRetryable,
      inboxFailedNonRetryable,
      inboxSkipped,
    };
  }

  private async count(query: ReturnType<typeof sql<CountRow>>): Promise<number> {
    const result = await query.execute(this.db);
    return countValue(result.rows[0]?.count);
  }
}
