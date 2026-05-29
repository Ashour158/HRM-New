import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import { sql, type Insertable, type Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import {
  PersonalDataRecord,
  type PersonalDataRecordState,
  type DataCategory,
} from '../aggregates/personal-data-record.aggregate.js';

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

  async findById(id: Uuid): Promise<PersonalDataRecord | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['personal_data_records']) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<PersonalDataRecord[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['personal_data_records']));
  }

  async findByWorkerAndCategory(workerId: Uuid, dataCategory: DataCategory): Promise<PersonalDataRecord | undefined> {
    const row = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
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
      .where('data_category', '=', dataCategory)
      .where(sql<string>`payload ->> ${fieldName}`, '=', value)
      .executeTakeFirst();
    return row ? this.toAggregate(row as unknown as Database['personal_data_records']) : undefined;
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
}
