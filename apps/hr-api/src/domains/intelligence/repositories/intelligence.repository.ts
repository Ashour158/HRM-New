import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import type {
  AttendancePayrollAnomalyFeatures,
  AttritionRiskFeatures,
  InsightFactor,
  InsightBand,
} from '@hcm/hr-intelligence';

export interface AttritionRiskSnapshot {
  id: string;
  tenantId: string;
  workerId: string;
  periodKey: string;
  modelKey: string;
  modelVersion: string;
  score: number;
  band: InsightBand;
  factors: InsightFactor[];
  featureSnapshot: AttritionRiskFeatures;
  sourceEventId?: string | null;
  createdAt: Date;
}

export interface AttendancePayrollAnomalySnapshot {
  id: string;
  tenantId: string;
  workerId: string;
  periodKey: string;
  modelKey: string;
  modelVersion: string;
  score: number;
  band: InsightBand;
  anomalyType: string;
  factors: InsightFactor[];
  featureSnapshot: AttendancePayrollAnomalyFeatures;
  notificationEventId?: string | null;
  sourceEventId?: string | null;
  createdAt: Date;
}

export interface SaveAttritionRiskSnapshotInput {
  tenantId: Uuid;
  workerId: Uuid;
  periodKey: string;
  modelKey: string;
  modelVersion: string;
  score: number;
  band: InsightBand;
  factors: InsightFactor[];
  featureSnapshot: AttritionRiskFeatures;
  sourceEventId?: Uuid;
}

export interface SaveAttendancePayrollAnomalySnapshotInput {
  tenantId: Uuid;
  workerId: Uuid;
  periodKey: string;
  modelKey: string;
  modelVersion: string;
  score: number;
  band: InsightBand;
  anomalyType: string;
  factors: InsightFactor[];
  featureSnapshot: AttendancePayrollAnomalyFeatures;
  notificationEventId?: Uuid;
  sourceEventId?: Uuid;
}

@Injectable()
export class IntelligenceRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async saveAttritionRiskSnapshot(input: SaveAttritionRiskSnapshotInput): Promise<AttritionRiskSnapshot> {
    const now = new Date().toISOString();
    const id = Uuid.generate().value;
    const row = await this.db
      .insertInto('hr_intelligence.attrition_risk_snapshots')
      .values({
        id,
        tenant_id: input.tenantId.value,
        worker_id: input.workerId.value,
        period_key: input.periodKey,
        model_key: input.modelKey,
        model_version: input.modelVersion,
        score: input.score,
        band: input.band,
        factors: JSON.stringify(input.factors),
        feature_snapshot: JSON.stringify(input.featureSnapshot),
        source_event_id: input.sourceEventId?.value ?? null,
        aggregate_version: 0,
        created_at: now,
        updated_at: now,
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toAttritionRiskSnapshot(row as Record<string, unknown>);
  }

  async saveAttendancePayrollAnomalySnapshot(input: SaveAttendancePayrollAnomalySnapshotInput): Promise<AttendancePayrollAnomalySnapshot> {
    const now = new Date().toISOString();
    const id = Uuid.generate().value;
    const row = await this.db
      .insertInto('hr_intelligence.attendance_payroll_anomaly_snapshots')
      .values({
        id,
        tenant_id: input.tenantId.value,
        worker_id: input.workerId.value,
        period_key: input.periodKey,
        model_key: input.modelKey,
        model_version: input.modelVersion,
        score: input.score,
        band: input.band,
        anomaly_type: input.anomalyType,
        factors: JSON.stringify(input.factors),
        feature_snapshot: JSON.stringify(input.featureSnapshot),
        notification_event_id: input.notificationEventId?.value ?? null,
        source_event_id: input.sourceEventId?.value ?? null,
        aggregate_version: 0,
        created_at: now,
        updated_at: now,
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toAttendancePayrollAnomalySnapshot(row as Record<string, unknown>);
  }

  async latestAttritionRiskForWorker(tenantId: Uuid, workerId: Uuid): Promise<AttritionRiskSnapshot | undefined> {
    const row = await this.db
      .selectFrom('hr_intelligence.attrition_risk_snapshots')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('worker_id', '=', workerId.value)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    return row ? toAttritionRiskSnapshot(row as Record<string, unknown>) : undefined;
  }

  async attritionRiskForTenant(tenantId: Uuid): Promise<AttritionRiskSnapshot[]> {
    const rows = await this.db
      .selectFrom('hr_intelligence.attrition_risk_snapshots')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute();
    return rows.map((row) => toAttritionRiskSnapshot(row as Record<string, unknown>));
  }

  async attritionRiskForWorkers(tenantId: Uuid, workerIds: Uuid[]): Promise<AttritionRiskSnapshot[]> {
    if (workerIds.length === 0) return [];
    const rows = await this.db
      .selectFrom('hr_intelligence.attrition_risk_snapshots')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('worker_id', 'in', workerIds.map((workerId) => workerId.value))
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute();
    return rows.map((row) => toAttritionRiskSnapshot(row as Record<string, unknown>));
  }

  async anomaliesForTenant(tenantId: Uuid): Promise<AttendancePayrollAnomalySnapshot[]> {
    const rows = await this.db
      .selectFrom('hr_intelligence.attendance_payroll_anomaly_snapshots')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute();
    return rows.map((row) => toAttendancePayrollAnomalySnapshot(row as Record<string, unknown>));
  }

  async anomaliesForWorkers(tenantId: Uuid, workerIds: Uuid[]): Promise<AttendancePayrollAnomalySnapshot[]> {
    if (workerIds.length === 0) return [];
    const rows = await this.db
      .selectFrom('hr_intelligence.attendance_payroll_anomaly_snapshots')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('worker_id', 'in', workerIds.map((workerId) => workerId.value))
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute();
    return rows.map((row) => toAttendancePayrollAnomalySnapshot(row as Record<string, unknown>));
  }
}

function toAttritionRiskSnapshot(row: Record<string, unknown>): AttritionRiskSnapshot {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    workerId: row.worker_id as string,
    periodKey: row.period_key as string,
    modelKey: row.model_key as string,
    modelVersion: row.model_version as string,
    score: Number(row.score),
    band: row.band as InsightBand,
    factors: (row.factors as InsightFactor[]) ?? [],
    featureSnapshot: row.feature_snapshot as AttritionRiskFeatures,
    sourceEventId: row.source_event_id as string | null,
    createdAt: new Date(row.created_at as string),
  };
}

function toAttendancePayrollAnomalySnapshot(row: Record<string, unknown>): AttendancePayrollAnomalySnapshot {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    workerId: row.worker_id as string,
    periodKey: row.period_key as string,
    modelKey: row.model_key as string,
    modelVersion: row.model_version as string,
    score: Number(row.score),
    band: row.band as InsightBand,
    anomalyType: row.anomaly_type as string,
    factors: (row.factors as InsightFactor[]) ?? [],
    featureSnapshot: row.feature_snapshot as AttendancePayrollAnomalyFeatures,
    notificationEventId: row.notification_event_id as string | null,
    sourceEventId: row.source_event_id as string | null,
    createdAt: new Date(row.created_at as string),
  };
}
