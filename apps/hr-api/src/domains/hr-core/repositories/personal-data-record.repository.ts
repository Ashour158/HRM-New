import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import { sql, type Insertable, type Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import {
  PersonalDataRecord,
  type PersonalDataRecordState,
  type DataCategory,
} from '../aggregates/personal-data-record.aggregate.js';

export interface PersonalDataExpiryAlertRow {
  workerId: string;
  recordId: string;
  dataCategory: string;
  fieldPath: string;
  expiryType: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

const EXPIRY_KEY_PATTERN = /(expiry|expires|expiration|validUntil|valid_to|endDate|end_date)/i;
const EXPIRY_TYPE_PATTERNS: Array<[RegExp, string]> = [
  [/passport/i, 'PASSPORT'],
  [/work.?permit|work.?authorization/i, 'WORK_PERMIT'],
  [/licen[cs]e/i, 'LICENSE'],
  [/certification|certificate/i, 'CERTIFICATION'],
  [/insurance/i, 'INSURANCE'],
  [/health.?card|medical/i, 'HEALTH_CARD'],
];

/**
 * Repository for {@link PersonalDataRecord} aggregates.
 * For SPECIAL_CATEGORY data, only encryptedPayloadRef is returned.
 */
@Injectable()
export class PersonalDataRecordRepository extends BaseRepository<'personal_data_records', PersonalDataRecord> {
  protected readonly tableName = 'personal_data_records' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for personal data record query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<PersonalDataRecord | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['personal_data_records']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<PersonalDataRecord[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['personal_data_records']));
  }

  async findByWorkerForTenant(workerId: Uuid, tenantId: Uuid): Promise<PersonalDataRecord[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['personal_data_records']));
  }

  async findByWorkerAndCategory(workerId: Uuid, dataCategory: DataCategory): Promise<PersonalDataRecord | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('worker_id', '=', workerId.value)
      .where('data_category', '=', dataCategory)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['personal_data_records']) : undefined;
  }

  async findByWorkerAndCategoryForTenant(
    workerId: Uuid,
    tenantId: Uuid,
    dataCategory: DataCategory,
  ): Promise<PersonalDataRecord | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .where('tenant_id', '=', tenantId.value)
      .where('data_category', '=', dataCategory)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['personal_data_records']) : undefined;
  }

  async findByPayloadField(
    dataCategory: DataCategory,
    fieldName: string,
    value: string,
  ): Promise<PersonalDataRecord | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('data_category', '=', dataCategory)
      .where(sql<string>`payload ->> ${fieldName}`, '=', value)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['personal_data_records']) : undefined;
  }

  async findByPayloadFieldForTenant(
    dataCategory: DataCategory,
    fieldName: string,
    value: string,
    tenantId: Uuid,
  ): Promise<PersonalDataRecord | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('data_category', '=', dataCategory)
      .where(sql<string>`payload ->> ${fieldName}`, '=', value)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['personal_data_records']) : undefined;
  }

  async findExpiringWithin(days: number): Promise<PersonalDataExpiryAlertRow[]> {
    return this.findExpiringWithinForTenant(days);
  }

  async findExpiringWithinForTenant(days: number, tenantId?: Uuid): Promise<PersonalDataExpiryAlertRow[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId?.value ?? this.requireTenantId())
      .execute();
    const alerts: PersonalDataExpiryAlertRow[] = [];

    for (const row of rows) {
      const payload = row.data_category === 'SPECIAL_CATEGORY'
        ? null
        : ((row.payload as Record<string, unknown> | null) ?? null);
      for (const candidate of this.findExpiryCandidates(payload ?? {}, row.data_category)) {
        const daysUntilExpiry = this.daysUntil(candidate.expiryDate);
        if (daysUntilExpiry <= days) {
          alerts.push({
            workerId: row.worker_id,
            recordId: row.id,
            dataCategory: row.data_category,
            fieldPath: candidate.fieldPath,
            expiryType: candidate.expiryType,
            expiryDate: candidate.expiryDate,
            daysUntilExpiry,
          });
        }
      }
    }

    return alerts.sort((left: any, right: any) => left.daysUntilExpiry - right.daysUntilExpiry);
  }

  async save(entity: PersonalDataRecord): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['personal_data_records']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['personal_data_records']>);
    }
  }

  private toAggregate(row: Database['personal_data_records']): PersonalDataRecord {
    const isSpecial = row.data_category === 'SPECIAL_CATEGORY';
    return new PersonalDataRecord({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      dataCategory: row.data_category as DataCategory,
      dataClassification: row.data_classification as 'LOW' | 'CONFIDENTIAL' | 'HIGH_SENSITIVITY' | 'SPECIAL_CATEGORY' | 'LEGAL_HOLD',
      encryptedPayloadRef: row.encrypted_payload_ref ?? undefined,
      payload: isSpecial ? null : ((row.payload as Record<string, unknown> | null) ?? undefined),
      consentStatus: row.consent_status,
      state: row.state as PersonalDataRecordState,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: PersonalDataRecord): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      data_category: entity.dataCategory,
      data_classification: entity.dataClassification,
      encrypted_payload_ref: entity.encryptedPayloadRef ?? null,
      payload: entity.dataCategory === 'SPECIAL_CATEGORY' ? null : (entity.payload ?? null),
      consent_status: entity.consentStatus,
      state: entity.state,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }

  private findExpiryCandidates(
    value: unknown,
    context: string,
    path = '',
  ): Array<{ fieldPath: string; expiryType: string; expiryDate: string }> {
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => this.findExpiryCandidates(item, context, `${path}[${index}]`));
    }

    const record = value as Record<string, unknown>;
    const matches: Array<{ fieldPath: string; expiryType: string; expiryDate: string }> = [];
    for (const [key, child] of Object.entries(record)) {
      const fieldPath = path ? `${path}.${key}` : key;
      if (EXPIRY_KEY_PATTERN.test(key)) {
        const expiryDate = this.isoDate(child as Date | string | undefined);
        if (expiryDate) {
          const siblingContext = Object.values(record)
            .filter((candidate): candidate is string => typeof candidate === 'string')
            .join('.');
          matches.push({
            fieldPath,
            expiryType: this.inferExpiryType(`${context}.${fieldPath}.${siblingContext}`),
            expiryDate,
          });
        }
      }
      matches.push(...this.findExpiryCandidates(child, `${context}.${key}`, fieldPath));
    }
    return matches;
  }

  private inferExpiryType(path: string): string {
    for (const [pattern, type] of EXPIRY_TYPE_PATTERNS) {
      if (pattern.test(path)) return type;
    }
    return 'DOCUMENT';
  }

  private isoDate(value: Date | string | undefined): string | undefined {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10);
  }

  private daysUntil(value: Date | string): number {
    const expiry = value instanceof Date ? value : new Date(value);
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const expiryDay = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
    return Math.ceil((expiryDay - today) / (24 * 60 * 60 * 1000));
  }
}
