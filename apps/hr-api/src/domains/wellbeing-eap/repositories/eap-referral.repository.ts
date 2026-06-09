import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { EapReferral, type EapReferralStatus } from '../aggregates/eap-referral.aggregate.js';

@Injectable()
export class EapReferralRepository extends BaseRepository<'eap_referrals', EapReferral> {
  protected readonly tableName = 'eap_referrals' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<EapReferral | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['eap_referrals']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<EapReferral[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['eap_referrals']));
  }



  async save(entity: EapReferral): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['eap_referrals']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['eap_referrals']>);
    }
  }

  private toAggregate(row: Database['eap_referrals']): EapReferral {
    return new EapReferral({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      reason: row.reason,
      status: row.status as EapReferralStatus,
      scheduledDate: row.scheduled_date ?? undefined,
      completedDate: row.completed_date ?? undefined,
      providerId: row.provider_id ? new Uuid(row.provider_id) : undefined,
      notes: row.notes ?? undefined,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: EapReferral): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      reason: entity.reason,
      status: entity.status,
      scheduled_date: entity.scheduledDate ?? null,
      completed_date: entity.completedDate ?? null,
      provider_id: entity.providerId?.value ?? null,
      notes: entity.notes ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
