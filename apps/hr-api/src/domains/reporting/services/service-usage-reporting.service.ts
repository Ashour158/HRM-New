import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { sql } from 'kysely';

export type ServiceUsageMetricSource = 'COMMAND' | 'OUTBOX' | 'NOTIFICATION' | 'WORKFLOW';

export interface ServiceUsageMetricRow {
  source: ServiceUsageMetricSource;
  serviceArea: string;
  total: number;
  failed?: number;
  pending?: number;
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
    notifications: number;
    workflowTransitions: number;
  };
  services: Array<{
    serviceArea: string;
    commands: number;
    failedCommands: number;
    events: number;
    pendingOutboxEvents: number;
    notifications: number;
    workflowTransitions: number;
    lastActivityAt?: string;
  }>;
}

interface ServiceUsageSqlRow {
  source: ServiceUsageMetricSource;
  service_area: string | null;
  total: string | number | bigint;
  failed: string | number | bigint | null;
  pending: string | number | bigint | null;
  last_activity_at: Date | string | null;
}

const SERVICE_AREA_PATTERNS: Array<[RegExp, string]> = [
  [/absence|leave/i, 'ABSENCE_LEAVE'],
  [/attendance|timesheet|time.?clock|overtime|work.?schedule/i, 'TIME_ATTENDANCE'],
  [/payroll|payslip|pay.?cycle|pay.?input|calculation.?run|result.?line/i, 'PAYROLL'],
  [/benefit|spending.?account|carrier.?reconciliation/i, 'BENEFITS'],
  [/compensation|bonus|equity|pay.?scale|total.?comp/i, 'COMPENSATION'],
  [/onboarding/i, 'ONBOARDING'],
  [/service.?case|knowledge|catalog|sla/i, 'SERVICE_DELIVERY'],
  [/compliance|policy.?document|acknowledgement|legal.?hold|statutory/i, 'COMPLIANCE'],
  [/country.?policy|country.?rule|statutory.?leave|work.?authorization/i, 'COUNTRY_POLICY'],
  [/position|headcount|org.?unit|legal.?entity|manager.?relationship/i, 'ORGANIZATION'],
  [/report|calculated.?field/i, 'REPORTING'],
  [/performance|goal|objective|review|kpi|calibration/i, 'PERFORMANCE'],
  [/learning|course|certification/i, 'LEARNING'],
  [/engagement|survey|recognition|feedback/i, 'ENGAGEMENT'],
  [/skill|talent|succession|career/i, 'TALENT'],
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
    notifications: 0,
    workflowTransitions: 0,
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
      notifications: 0,
      workflowTransitions: 0,
    };
    const total = row.total ?? 0;
    const failed = row.failed ?? 0;
    const pending = row.pending ?? 0;

    if (row.source === 'COMMAND') {
      target.commands += total;
      target.failedCommands += failed;
      totals.commands += total;
      totals.failedCommands += failed;
    } else if (row.source === 'OUTBOX') {
      target.events += total;
      target.pendingOutboxEvents += pending;
      totals.events += total;
      totals.pendingOutboxEvents += pending;
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
    services: [...byService.values()].sort((a, b) => {
      const activity = (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '');
      return activity || a.serviceArea.localeCompare(b.serviceArea);
    }),
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
          COUNT(*) FILTER (WHERE published_at IS NULL) AS pending,
          MAX(created_at) AS last_activity_at
        FROM hr_platform.outbox_events
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
          MAX(occurred_at) AS last_activity_at
        FROM hr_platform.transition_ledgers
        WHERE tenant_id = ${tenantId.value}
          AND (${from}::timestamptz IS NULL OR occurred_at >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR occurred_at <= ${to}::timestamptz)
        GROUP BY aggregate_type
      )
      SELECT * FROM command_usage
      UNION ALL SELECT * FROM outbox_usage
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
        lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at) : null,
      })),
    );
  }
}

function numberValue(value: string | number | bigint | null | undefined): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}
