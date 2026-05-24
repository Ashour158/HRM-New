import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { ContractorRateCard, type ContractorRateCardStatus } from '../aggregates/contractor-rate-card.aggregate.js';

@Injectable()
export class ContractorRateCardRepository extends BaseRepository<'contractor_rate_cards', ContractorRateCard> {
  protected readonly tableName = 'contractor_rate_cards' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<ContractorRateCard | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['contractor_rate_cards']) : undefined;
  }

  async save(entity: ContractorRateCard): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['contractor_rate_cards']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['contractor_rate_cards']>);
    }
  }

  private toAggregate(row: Database['contractor_rate_cards']): ContractorRateCard {
    return new ContractorRateCard({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      vendorId: new Uuid(row.vendor_id),
      jobTitle: row.job_title,
      rate: row.rate,
      currency: row.currency,
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until ?? undefined,
      status: row.status as ContractorRateCardStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: ContractorRateCard): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      vendor_id: entity.vendorId.value,
      job_title: entity.jobTitle,
      rate: entity.rate,
      currency: entity.currency,
      effective_from: entity.effectiveFrom,
      effective_until: entity.effectiveUntil ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
