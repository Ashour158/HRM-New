import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { PayEquityReview } from '../aggregates/pay-equity-review.aggregate.js';

@Injectable()
export class PayEquityReviewRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid): Promise<PayEquityReview | undefined> {
    const row = await this.db.selectFrom('hr_dei_analytics.pay_equity_reviews').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByStatus(status: string): Promise<PayEquityReview[]> {
    const rows = await this.db.selectFrom('hr_dei_analytics.pay_equity_reviews').selectAll().where('status', '=', status).execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: PayEquityReview): Promise<void> {
    const existing = await this.db.selectFrom('hr_dei_analytics.pay_equity_reviews').select('id').where('id', '=', entity.id.value).executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      review_name: entity.reviewName,
      review_period: entity.reviewPeriod,
      scope: entity.scope,
      findings: entity.findings,
      remediation_actions: entity.remediationActions,
      completed_actions: entity.completedActions,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db.updateTable('hr_dei_analytics.pay_equity_reviews').set(row).where('id', '=', entity.id.value).execute();
    } else {
      await this.db.insertInto('hr_dei_analytics.pay_equity_reviews').values({ ...row, created_at: new Date().toISOString() } as never).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): PayEquityReview {
    return new PayEquityReview({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      reviewName: row.review_name as string,
      reviewPeriod: row.review_period as string,
      scope: (row.scope as Record<string, unknown>) ?? {},
      findings: (row.findings as Record<string, unknown>) ?? {},
      remediationActions: (row.remediation_actions as Record<string, unknown>) ?? {},
      completedActions: (row.completed_actions as Record<string, unknown>) ?? {},
      status: row.status as PayEquityReview['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
