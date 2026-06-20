import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { StatutoryReport } from '../aggregates/statutory-report.aggregate.js';

/**
 * Repository for {@link StatutoryReport} aggregates.
 *
 * Uses the Kysely `hr_compliance.statutory_reports` table.
 */
@Injectable()
export class StatutoryReportRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<StatutoryReport | undefined> {
    const row = await this.db
      .selectFrom('hr_compliance.statutory_reports')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByLegalEntity(legalEntityId: Uuid): Promise<StatutoryReport[]> {
    const rows = await this.db
      .selectFrom('hr_compliance.statutory_reports')
      .selectAll()
      .where('legal_entity_id', '=', legalEntityId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async findByCountryCode(countryCode: string): Promise<StatutoryReport[]> {
    const rows = await this.db
      .selectFrom('hr_compliance.statutory_reports')
      .selectAll()
      .where('country_code', '=', countryCode)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async findByTenant(tenantId: Uuid): Promise<StatutoryReport[]> {
    const rows = await this.db
      .selectFrom('hr_compliance.statutory_reports')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: StatutoryReport): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_compliance.statutory_reports')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      report_type: entity.reportType,
      reporting_period: entity.reportingPeriod,
      country_code: entity.countryCode,
      legal_entity_id: entity.legalEntityId.value,
      content: entity.content,
      submitted_at: entity.submittedAt ?? null,
      filed_at: entity.filedAt ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_compliance.statutory_reports')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_compliance.statutory_reports')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): StatutoryReport {
    return new StatutoryReport({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      reportType: row.report_type as string,
      reportingPeriod: row.reporting_period as string,
      countryCode: row.country_code as string,
      legalEntityId: new Uuid(row.legal_entity_id as string),
      content: (row.content as Record<string, unknown>) ?? {},
      submittedAt: row.submitted_at ? new Date(row.submitted_at as string) : undefined,
      filedAt: row.filed_at ? new Date(row.filed_at as string) : undefined,
      status: row.status as StatutoryReport['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
