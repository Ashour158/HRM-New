import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { sql } from 'kysely';

export type ServiceUsageMetricSource = 'COMMAND' | 'OUTBOX' | 'INBOX_QUEUE' | 'NOTIFICATION' | 'WORKFLOW';

export interface ServiceUsageMetricRow {
  source: ServiceUsageMetricSource;
  serviceArea: string;
  total: number;
  failed?: number;
  pending?: number;
  exhausted?: number;
  inProgress?: number;
  failedRetryable?: number;
  failedNonRetryable?: number;
  skipped?: number;
  oldestQueueBacklogAt?: Date | string | null;
  lastActivityAt?: Date | null;
}

export interface ServiceUsageSummaryOptions {
  from?: Date;
  to?: Date;
}

export interface ServiceUsageSummary {
  tenantId: string;
  generatedAt: string;
  totals: {
    commands: number;
    failedCommands: number;
    events: number;
    pendingOutboxEvents: number;
    exhaustedOutboxEvents: number;
    inboxInProgressEvents: number;
    inboxFailedRetryableEvents: number;
    inboxFailedNonRetryableEvents: number;
    inboxSkippedEvents: number;
    oldestQueueBacklogAt?: string;
    notifications: number;
    workflowTransitions: number;
  };
  queueHealth: {
    outbox: {
      pendingEvents: number;
      exhaustedEvents: number;
      oldestBacklogAt?: string;
    };
    inbox: {
      inProgressEvents: number;
      failedRetryableEvents: number;
      failedNonRetryableEvents: number;
      skippedEvents: number;
      oldestBacklogAt?: string;
    };
  };
  services: Array<{
    serviceArea: string;
    commands: number;
    failedCommands: number;
    events: number;
    pendingOutboxEvents: number;
    exhaustedOutboxEvents: number;
    inboxInProgressEvents: number;
    inboxFailedRetryableEvents: number;
    inboxFailedNonRetryableEvents: number;
    inboxSkippedEvents: number;
    oldestQueueBacklogAt?: string;
    notifications: number;
    workflowTransitions: number;
    lastActivityAt?: string;
  }>;
}

export interface HrReportDashboard {
  tenantId: string;
  generatedAt: string;
  totals: {
    reportGroups: number;
    activeReportGroups: number;
    totalActivity: number;
    queueBacklog: number;
    issues: number;
  };
  reports: Array<{
    code: string;
    title: string;
    category: string;
    services: string[];
    activity: number;
    commands: number;
    events: number;
    notifications: number;
    workflowTransitions: number;
    queueBacklog: number;
    issues: number;
    readiness: 'Live' | 'Attention' | 'No Data';
    lastActivityAt?: string;
    chartData: Array<{ label: string; value: number }>;
  }>;
  activityByReport: Array<{ label: string; activity: number; issues: number }>;
  queueHealth: ServiceUsageSummary['queueHealth'];
}

interface ServiceUsageSqlRow {
  source: ServiceUsageMetricSource;
  service_area: string | null;
  total: string | number | bigint;
  failed: string | number | bigint | null;
  pending: string | number | bigint | null;
  exhausted: string | number | bigint | null;
  in_progress: string | number | bigint | null;
  failed_retryable: string | number | bigint | null;
  failed_non_retryable: string | number | bigint | null;
  skipped: string | number | bigint | null;
  oldest_queue_backlog_at: Date | string | null;
  last_activity_at: Date | string | null;
}

const SERVICE_AREA_PATTERNS: Array<[RegExp, string]> = [
  [/absence|leave/i, 'ABSENCE_LEAVE'],
  [/attendance|timesheet|time.?clock|overtime|work.?schedule/i, 'TIME_ATTENDANCE'],
  [/payroll|payslip|pay.?cycle|pay.?input|calculation.?run|result.?line/i, 'PAYROLL'],
  [/benefit|spending.?account|carrier.?reconciliation/i, 'BENEFITS'],
  [/dei|diversity|pay.?gap|pay.?equity|attrition.?segment/i, 'DEI_ANALYTICS'],
  [/compensation|bonus|equity|pay.?scale|total.?comp/i, 'COMPENSATION'],
  [/onboarding/i, 'ONBOARDING'],
  [/service.?case|knowledge|catalog|sla/i, 'SERVICE_DELIVERY'],
  [/compliance|policy.?document|acknowledgement|legal.?hold|statutory/i, 'COMPLIANCE'],
  [/policy.?revision|policy.?application|policy.?impact|admin.?policy/i, 'POLICY_CENTER'],
  [/access.?governance|access.?review|service.?account|role.?permission|user.?role|field.?access|sod/i, 'ACCESS_GOVERNANCE'],
  [/country.?policy|country.?rule|statutory.?leave|work.?authorization/i, 'COUNTRY_POLICY'],
  [/worker.?profile|worker|employee.?profile|employment.?contract|emergency.?contact/i, 'HR_CORE'],
  [/position|headcount|org.?unit|legal.?entity|manager.?relationship/i, 'ORGANIZATION'],
  [/report|calculated.?field|service.?usage.?metric|service.?usage.?summary/i, 'REPORTING'],
  [/audit|event.?contract|topic.?registry|dead.?letter|outbox|inbox/i, 'SYSTEM_GOVERNANCE'],
  [/performance|goal|objective|review|kpi|calibration/i, 'PERFORMANCE'],
  [/learning|course|certification/i, 'LEARNING'],
  [/engagement|survey|recognition|feedback/i, 'ENGAGEMENT'],
  [/skill|talent|succession|career/i, 'TALENT'],
];

const HR_REPORT_GROUPS: Array<{
  code: string;
  title: string;
  category: string;
  services: string[];
}> = [
  { code: 'ATTENDANCE', title: 'Attendance Report', category: 'Workforce', services: ['TIME_ATTENDANCE'] },
  { code: 'LEAVE', title: 'Leave Report', category: 'Workforce', services: ['ABSENCE_LEAVE'] },
  { code: 'PAYROLL', title: 'Payroll Report', category: 'Reward', services: ['PAYROLL', 'COMPENSATION'] },
  { code: 'BENEFITS', title: 'Benefits Report', category: 'Reward', services: ['BENEFITS'] },
  { code: 'PERFORMANCE', title: 'Performance Report', category: 'Talent', services: ['PERFORMANCE', 'LEARNING', 'TALENT'] },
  { code: 'ENGAGEMENT', title: 'Engagement Report', category: 'People Experience', services: ['ENGAGEMENT'] },
  { code: 'EMPLOYEE', title: 'Employee Master Report', category: 'Core HR', services: ['HR_CORE', 'ORGANIZATION', 'ONBOARDING', 'SERVICE_DELIVERY'] },
  { code: 'GOVERNANCE', title: 'Governance Report', category: 'Governance', services: ['COMPLIANCE', 'POLICY_CENTER', 'ACCESS_GOVERNANCE', 'COUNTRY_POLICY', 'DEI_ANALYTICS', 'REPORTING', 'SYSTEM_GOVERNANCE'] },
];

export function normalizeServiceArea(raw: string | null | undefined): string {
  const value = raw?.trim();
  if (!value) return 'UNKNOWN';
  const normalized = value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[-\s.]+/g, '_').toUpperCase();
  for (const [pattern, area] of SERVICE_AREA_PATTERNS) {
    if (pattern.test(value) || pattern.test(normalized)) return area;
  }
  return normalized;
}

export function buildServiceUsageSummary(
  tenantId: string,
  rows: ServiceUsageMetricRow[],
  generatedAt = new Date(),
): ServiceUsageSummary {
  const totals: ServiceUsageSummary['totals'] = {
    commands: 0,
    failedCommands: 0,
    events: 0,
    pendingOutboxEvents: 0,
    exhaustedOutboxEvents: 0,
    inboxInProgressEvents: 0,
    inboxFailedRetryableEvents: 0,
    inboxFailedNonRetryableEvents: 0,
    inboxSkippedEvents: 0,
    notifications: 0,
    workflowTransitions: 0,
  };
  const queueHealth: ServiceUsageSummary['queueHealth'] = {
    outbox: {
      pendingEvents: 0,
      exhaustedEvents: 0,
    },
    inbox: {
      inProgressEvents: 0,
      failedRetryableEvents: 0,
      failedNonRetryableEvents: 0,
      skippedEvents: 0,
    },
  };
  const byService = new Map<string, ServiceUsageSummary['services'][number]>();

  for (const row of rows) {
    const serviceArea = normalizeServiceArea(row.serviceArea);
    const target = byService.get(serviceArea) ?? {
      serviceArea,
      commands: 0,
      failedCommands: 0,
      events: 0,
      pendingOutboxEvents: 0,
      exhaustedOutboxEvents: 0,
      inboxInProgressEvents: 0,
      inboxFailedRetryableEvents: 0,
      inboxFailedNonRetryableEvents: 0,
      inboxSkippedEvents: 0,
      notifications: 0,
      workflowTransitions: 0,
    };
    const total = row.total ?? 0;
    const failed = row.failed ?? 0;
    const pending = row.pending ?? 0;
    const exhausted = row.exhausted ?? 0;
    const inProgress = row.inProgress ?? 0;
    const failedRetryable = row.failedRetryable ?? 0;
    const failedNonRetryable = row.failedNonRetryable ?? 0;
    const skipped = row.skipped ?? 0;

    if (row.source === 'COMMAND') {
      target.commands += total;
      target.failedCommands += failed;
      totals.commands += total;
      totals.failedCommands += failed;
    } else if (row.source === 'OUTBOX') {
      target.events += total;
      target.pendingOutboxEvents += pending;
      target.exhaustedOutboxEvents += exhausted;
      totals.events += total;
      totals.pendingOutboxEvents += pending;
      totals.exhaustedOutboxEvents += exhausted;
      queueHealth.outbox.pendingEvents += pending;
      queueHealth.outbox.exhaustedEvents += exhausted;
      updateOldestQueueBacklog(row.oldestQueueBacklogAt, target, totals, queueHealth.outbox);
    } else if (row.source === 'INBOX_QUEUE') {
      target.inboxInProgressEvents += inProgress;
      target.inboxFailedRetryableEvents += failedRetryable;
      target.inboxFailedNonRetryableEvents += failedNonRetryable;
      target.inboxSkippedEvents += skipped;
      totals.inboxInProgressEvents += inProgress;
      totals.inboxFailedRetryableEvents += failedRetryable;
      totals.inboxFailedNonRetryableEvents += failedNonRetryable;
      totals.inboxSkippedEvents += skipped;
      queueHealth.inbox.inProgressEvents += inProgress;
      queueHealth.inbox.failedRetryableEvents += failedRetryable;
      queueHealth.inbox.failedNonRetryableEvents += failedNonRetryable;
      queueHealth.inbox.skippedEvents += skipped;
      updateOldestQueueBacklog(row.oldestQueueBacklogAt, target, totals, queueHealth.inbox);
    } else if (row.source === 'NOTIFICATION') {
      target.notifications += total;
      totals.notifications += total;
    } else if (row.source === 'WORKFLOW') {
      target.workflowTransitions += total;
      totals.workflowTransitions += total;
    }

    const latest = row.lastActivityAt instanceof Date
      ? row.lastActivityAt
      : row.lastActivityAt ? new Date(row.lastActivityAt) : undefined;
    if (latest && !Number.isNaN(latest.getTime())) {
      const current = target.lastActivityAt ? new Date(target.lastActivityAt) : undefined;
      if (!current || latest > current) target.lastActivityAt = latest.toISOString();
    }

    byService.set(serviceArea, target);
  }

  return {
    tenantId,
    generatedAt: generatedAt.toISOString(),
    totals,
    queueHealth,
    services: [...byService.values()].sort((a, b) => {
      const activity = (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '');
      return activity || a.serviceArea.localeCompare(b.serviceArea);
    }),
  };
}

export function buildHrReportsDashboard(summary: ServiceUsageSummary): HrReportDashboard {
  const servicesByArea = new Map(summary.services.map((service) => [service.serviceArea, service]));
  const reports = HR_REPORT_GROUPS.map((group) => {
    const services = group.services
      .map((serviceArea) => servicesByArea.get(serviceArea))
      .filter((service): service is ServiceUsageSummary['services'][number] => Boolean(service));
    const commands = services.reduce((total, service) => total + service.commands, 0);
    const events = services.reduce((total, service) => total + service.events, 0);
    const notifications = services.reduce((total, service) => total + service.notifications, 0);
    const workflowTransitions = services.reduce((total, service) => total + service.workflowTransitions, 0);
    const queueBacklog = services.reduce(
      (total, service) => total
        + service.pendingOutboxEvents
        + service.exhaustedOutboxEvents
        + service.inboxInProgressEvents
        + service.inboxFailedRetryableEvents
        + service.inboxFailedNonRetryableEvents,
      0,
    );
    const issues = services.reduce(
      (total, service) => total
        + service.failedCommands
        + service.pendingOutboxEvents
        + service.exhaustedOutboxEvents
        + service.inboxFailedRetryableEvents
        + service.inboxFailedNonRetryableEvents,
      0,
    );
    const activity = commands + events + notifications + workflowTransitions;
    const lastActivityAt = services
      .map((service) => service.lastActivityAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    const readiness: HrReportDashboard['reports'][number]['readiness'] = issues > 0
      ? 'Attention'
      : activity > 0
        ? 'Live'
        : 'No Data';

    return {
      code: group.code,
      title: group.title,
      category: group.category,
      services: group.services,
      activity,
      commands,
      events,
      notifications,
      workflowTransitions,
      queueBacklog,
      issues,
      readiness,
      ...(lastActivityAt ? { lastActivityAt } : {}),
      chartData: [
        { label: 'Commands', value: commands },
        { label: 'Events', value: events },
        { label: 'Notifications', value: notifications },
        { label: 'Workflows', value: workflowTransitions },
      ],
    };
  });

  return {
    tenantId: summary.tenantId,
    generatedAt: summary.generatedAt,
    totals: {
      reportGroups: reports.length,
      activeReportGroups: reports.filter((report) => report.activity > 0).length,
      totalActivity: reports.reduce((total, report) => total + report.activity, 0),
      queueBacklog: reports.reduce((total, report) => total + report.queueBacklog, 0),
      issues: reports.reduce((total, report) => total + report.issues, 0),
    },
    reports,
    activityByReport: reports.map((report) => ({
      label: report.title,
      activity: report.activity,
      issues: report.issues,
    })),
    queueHealth: summary.queueHealth,
  };
}

@Injectable()
export class ServiceUsageReportingService {
  private readonly db = createKyselyInstance(getPool());

  async getSummary(tenantId: Uuid, options: ServiceUsageSummaryOptions = {}): Promise<ServiceUsageSummary> {
    const from = options.from ?? null;
    const to = options.to ?? null;
    const result = await sql<ServiceUsageSqlRow>`
      WITH command_usage AS (
        SELECT
          'COMMAND'::text AS source,
          aggregate_type AS service_area,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
          0 AS pending,
          0 AS exhausted,
          0 AS in_progress,
          0 AS failed_retryable,
          0 AS failed_non_retryable,
          0 AS skipped,
          NULL::timestamptz AS oldest_queue_backlog_at,
          MAX(created_at) AS last_activity_at
        FROM hr_platform.idempotency_keys
        WHERE tenant_id = ${tenantId.value}
          AND (${from}::timestamptz IS NULL OR created_at >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR created_at <= ${to}::timestamptz)
        GROUP BY aggregate_type
      ),
      outbox_usage AS (
        SELECT
          'OUTBOX'::text AS source,
          aggregate_type AS service_area,
          COUNT(*) AS total,
          0 AS failed,
          COUNT(*) FILTER (
            WHERE published_at IS NULL
              AND publish_attempt_count < 5
              AND COALESCE(metadata->'deadLetterOperator'->>'action', '') <> 'SKIP'
          ) AS pending,
          COUNT(*) FILTER (
            WHERE published_at IS NULL
              AND publish_attempt_count >= 5
              AND COALESCE(metadata->'deadLetterOperator'->>'action', '') <> 'SKIP'
          ) AS exhausted,
          0 AS in_progress,
          0 AS failed_retryable,
          0 AS failed_non_retryable,
          0 AS skipped,
          MIN(created_at) FILTER (
            WHERE published_at IS NULL
              AND COALESCE(metadata->'deadLetterOperator'->>'action', '') <> 'SKIP'
          ) AS oldest_queue_backlog_at,
          MAX(created_at) AS last_activity_at
        FROM hr_platform.outbox_events
        WHERE tenant_id = ${tenantId.value}
          AND (${from}::timestamptz IS NULL OR created_at >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR created_at <= ${to}::timestamptz)
        GROUP BY aggregate_type
      ),
      inbox_queue_usage AS (
        SELECT
          'INBOX_QUEUE'::text AS source,
          aggregate_type AS service_area,
          COUNT(*) AS total,
          0 AS failed,
          0 AS pending,
          0 AS exhausted,
          COUNT(*) FILTER (WHERE processing_status = 'IN_PROGRESS') AS in_progress,
          COUNT(*) FILTER (WHERE processing_status = 'FAILED_RETRYABLE') AS failed_retryable,
          COUNT(*) FILTER (WHERE processing_status = 'FAILED_NON_RETRYABLE') AS failed_non_retryable,
          COUNT(*) FILTER (WHERE processing_status = 'SKIPPED') AS skipped,
          MIN(created_at) FILTER (WHERE processing_status IN ('IN_PROGRESS', 'FAILED_RETRYABLE', 'FAILED_NON_RETRYABLE')) AS oldest_queue_backlog_at,
          MAX(created_at) AS last_activity_at
        FROM hr_platform.inbox_events
        WHERE tenant_id = ${tenantId.value}
          AND (${from}::timestamptz IS NULL OR created_at >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR created_at <= ${to}::timestamptz)
        GROUP BY aggregate_type
      ),
      notification_usage AS (
        SELECT
          'NOTIFICATION'::text AS source,
          related_aggregate_type AS service_area,
          COUNT(*) AS total,
          0 AS failed,
          0 AS pending,
          0 AS exhausted,
          0 AS in_progress,
          0 AS failed_retryable,
          0 AS failed_non_retryable,
          0 AS skipped,
          NULL::timestamptz AS oldest_queue_backlog_at,
          MAX(created_at) AS last_activity_at
        FROM hr_platform.platform_notifications
        WHERE tenant_id = ${tenantId.value}
          AND (${from}::timestamptz IS NULL OR created_at >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR created_at <= ${to}::timestamptz)
        GROUP BY related_aggregate_type
      ),
      workflow_usage AS (
        SELECT
          'WORKFLOW'::text AS source,
          aggregate_type AS service_area,
          COUNT(*) AS total,
          0 AS failed,
          0 AS pending,
          0 AS exhausted,
          0 AS in_progress,
          0 AS failed_retryable,
          0 AS failed_non_retryable,
          0 AS skipped,
          NULL::timestamptz AS oldest_queue_backlog_at,
          MAX(occurred_at) AS last_activity_at
        FROM hr_platform.transition_ledgers
        WHERE tenant_id = ${tenantId.value}
          AND (${from}::timestamptz IS NULL OR occurred_at >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR occurred_at <= ${to}::timestamptz)
        GROUP BY aggregate_type
      )
      SELECT * FROM command_usage
      UNION ALL SELECT * FROM outbox_usage
      UNION ALL SELECT * FROM inbox_queue_usage
      UNION ALL SELECT * FROM notification_usage
      UNION ALL SELECT * FROM workflow_usage
    `.execute(this.db);

    return buildServiceUsageSummary(
      tenantId.value,
      result.rows.map((row) => ({
        source: row.source,
        serviceArea: row.service_area ?? 'UNKNOWN',
        total: numberValue(row.total),
        failed: numberValue(row.failed),
        pending: numberValue(row.pending),
        exhausted: numberValue(row.exhausted),
        inProgress: numberValue(row.in_progress),
        failedRetryable: numberValue(row.failed_retryable),
        failedNonRetryable: numberValue(row.failed_non_retryable),
        skipped: numberValue(row.skipped),
        oldestQueueBacklogAt: row.oldest_queue_backlog_at ? new Date(row.oldest_queue_backlog_at) : null,
        lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at) : null,
      })),
    );
  }

  async getHrDashboard(tenantId: Uuid, options: ServiceUsageSummaryOptions = {}): Promise<HrReportDashboard> {
    const summary = await this.getSummary(tenantId, options);
    return buildHrReportsDashboard(summary);
  }
}

function numberValue(value: string | number | bigint | null | undefined): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function updateOldestQueueBacklog(
  value: Date | string | null | undefined,
  service: ServiceUsageSummary['services'][number],
  totals: ServiceUsageSummary['totals'],
  queue: { oldestBacklogAt?: string },
): void {
  const date = value instanceof Date ? value : value ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) return;
  const iso = date.toISOString();
  service.oldestQueueBacklogAt = oldestIso(service.oldestQueueBacklogAt, iso);
  totals.oldestQueueBacklogAt = oldestIso(totals.oldestQueueBacklogAt, iso);
  queue.oldestBacklogAt = oldestIso(queue.oldestBacklogAt, iso);
}

function oldestIso(current: string | undefined, candidate: string): string {
  if (!current) return candidate;
  return candidate < current ? candidate : current;
}
