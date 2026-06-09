import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import { KpiMeasurement, type KpiMeasurementStatus } from '../aggregates/kpi-measurement.aggregate.js';

@Injectable()
export class KpiMeasurementRepository extends BaseRepository<'kpi_measurements', KpiMeasurement> {
  protected readonly tableName = 'kpi_measurements' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<KpiMeasurement | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByKpi(kpiId: Uuid): Promise<KpiMeasurement[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('kpi_id', '=', kpiId.value).orderBy('period_start desc').execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: KpiMeasurement): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): KpiMeasurement {
    return new KpiMeasurement({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      kpiId: new Uuid(row.kpi_id),
      periodStart: row.period_start,
      periodEnd: row.period_end,
      actualValue: row.actual_value,
      targetValue: row.target_value ?? undefined,
      variance: row.variance ?? undefined,
      variancePercentage: row.variance_percentage ?? undefined,
      status: (row.status as KpiMeasurementStatus) ?? 'RECORDED',
      recordedBy: row.recorded_by ? new Uuid(row.recorded_by) : undefined,
      validatedBy: row.validated_by ? new Uuid(row.validated_by) : undefined,
      notes: row.notes ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: KpiMeasurement): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      kpi_id: entity.kpiId.value,
      period_start: entity.periodStart,
      period_end: entity.periodEnd,
      actual_value: entity.actualValue,
      target_value: entity.targetValue ?? null,
      variance: entity.variance ?? null,
      variance_percentage: entity.variancePercentage ?? null,
      status: entity.status,
      recorded_by: entity.recordedBy?.value ?? null,
      validated_by: entity.validatedBy?.value ?? null,
      notes: entity.notes ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
