import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { TimeClockEvent, type TimeClockCaptureMethod, type TimeClockEventStatus, type TimeClockEventType } from '../aggregates/time-clock-event.aggregate.js';

function parseJsonArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : undefined;
  } catch {
    return undefined;
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

@Injectable()
export class TimeClockEventRepository extends BaseRepository<'time_clock_events', TimeClockEvent> {
  protected readonly tableName = 'time_clock_events' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<TimeClockEvent | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['time_clock_events']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<TimeClockEvent[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['time_clock_events']));
  }

  async findByWorkerForTenant(tenantId: Uuid, workerId: Uuid): Promise<TimeClockEvent[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('worker_id', '=', workerId.value)
      .orderBy('timestamp', 'asc')
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['time_clock_events']));
  }

  async findByWorkersBetween(workerIds: Uuid[], startAt: Date, endAt: Date): Promise<TimeClockEvent[]> {
    if (workerIds.length === 0) return [];
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', 'in', workerIds.map((id) => id.value))
      .where('timestamp', '>=', startAt)
      .where('timestamp', '<', endAt)
      .orderBy('timestamp', 'asc')
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['time_clock_events']));
  }

  async findByWorkersBetweenForTenant(tenantId: Uuid, workerIds: Uuid[], startAt: Date, endAt: Date): Promise<TimeClockEvent[]> {
    if (workerIds.length === 0) return [];
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('worker_id', 'in', workerIds.map((id) => id.value))
      .where('timestamp', '>=', startAt)
      .where('timestamp', '<', endAt)
      .orderBy('timestamp', 'asc')
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['time_clock_events']));
  }

  async save(entity: TimeClockEvent): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['time_clock_events']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['time_clock_events']>);
    }
  }

  private toAggregate(row: Database['time_clock_events']): TimeClockEvent {
    return new TimeClockEvent({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      eventType: row.event_type as TimeClockEventType,
      timestamp: row.timestamp,
      location: row.location ?? undefined,
      latitude: row.latitude === null || row.latitude === undefined ? undefined : Number(row.latitude),
      longitude: row.longitude === null || row.longitude === undefined ? undefined : Number(row.longitude),
      accuracyMeters: row.accuracy_meters === null || row.accuracy_meters === undefined ? undefined : Number(row.accuracy_meters),
      workplaceCode: row.workplace_code ?? undefined,
      distanceMeters: row.distance_meters === null || row.distance_meters === undefined ? undefined : Number(row.distance_meters),
      geofenceRadiusMeters: row.geofence_radius_meters === null || row.geofence_radius_meters === undefined ? undefined : Number(row.geofence_radius_meters),
      geofenceProfileCode: row.geofence_profile_code ?? undefined,
      locationStatus: row.location_status ?? undefined,
      deviceTrustLevel: row.device_trust_level ?? undefined,
      trustLevel: row.trust_level ?? undefined,
      trustScore: row.trust_score === null || row.trust_score === undefined ? undefined : Number(row.trust_score),
      trustRequiresApproval: row.trust_requires_approval ?? undefined,
      trustReasons: parseJsonArray(row.trust_reasons),
      deviceId: row.device_id ?? undefined,
      captureMethod: row.capture_method ? row.capture_method as TimeClockCaptureMethod : undefined,
      captureDeviceKind: row.capture_device_kind ?? undefined,
      captureReference: row.capture_reference ?? undefined,
      verificationStatus: row.verification_status ? row.verification_status as TimeClockEvent['verificationStatus'] : undefined,
      captureEvidence: parseJsonObject(row.capture_evidence),
      status: row.status as TimeClockEventStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: TimeClockEvent): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      event_type: entity.eventType,
      timestamp: entity.timestamp,
      location: entity.location ?? null,
      latitude: entity.latitude ?? null,
      longitude: entity.longitude ?? null,
      accuracy_meters: entity.accuracyMeters ?? null,
      workplace_code: entity.workplaceCode ?? null,
      distance_meters: entity.distanceMeters ?? null,
      geofence_radius_meters: entity.geofenceRadiusMeters ?? null,
      geofence_profile_code: entity.geofenceProfileCode ?? null,
      location_status: entity.locationStatus ?? null,
      device_trust_level: entity.deviceTrustLevel ?? null,
      trust_level: entity.trustLevel ?? null,
      trust_score: entity.trustScore ?? null,
      trust_requires_approval: entity.trustRequiresApproval ?? null,
      trust_reasons: entity.trustReasons ? JSON.stringify(entity.trustReasons) : null,
      device_id: entity.deviceId ?? null,
      capture_method: entity.captureMethod ?? null,
      capture_device_kind: entity.captureDeviceKind ?? null,
      capture_reference: entity.captureReference ?? null,
      verification_status: entity.verificationStatus ?? null,
      capture_evidence: JSON.stringify(entity.captureEvidence ?? {}),
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
