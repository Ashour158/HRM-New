import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { StatutoryLeaveType } from '../aggregates/statutory-leave-type.aggregate.js';

/**
 * Repository for {@link StatutoryLeaveType} aggregates.
 *
 * Uses the Kysely `hr_global_hr.statutory_leave_types` table.
 */
@Injectable()
export class StatutoryLeaveTypeRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<StatutoryLeaveType | undefined> {
    const row = await this.db
      .selectFrom('hr_global_hr.statutory_leave_types')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByCountryCode(countryCode: string): Promise<StatutoryLeaveType[]> {
    const rows = await this.db
      .selectFrom('hr_global_hr.statutory_leave_types')
      .selectAll()
      .where('country_code', '=', countryCode)
      .execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async findActiveByCountryCode(countryCode: string): Promise<StatutoryLeaveType[]> {
    const rows = await this.db
      .selectFrom('hr_global_hr.statutory_leave_types')
      .selectAll()
      .where('country_code', '=', countryCode)
      .where('status', '=', 'ACTIVE')
      .execute();
    return rows.map((r) => this.toAggregate(r));
  }

  async save(entity: StatutoryLeaveType): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_global_hr.statutory_leave_types')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      country_code: entity.countryCode,
      leave_type_code: entity.leaveTypeCode,
      leave_type_name: entity.leaveTypeName,
      minimum_entitlement: entity.minimumEntitlement,
      unit: entity.unit,
      carryover_allowed: entity.carryoverAllowed,
      max_carryover: entity.maxCarryover,
      effective_from: entity.effectiveFrom,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_global_hr.statutory_leave_types')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_global_hr.statutory_leave_types')
        .values({ ...row, created_at: new Date().toISOString() } as any)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): StatutoryLeaveType {
    return new StatutoryLeaveType({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      countryCode: row.country_code as string,
      leaveTypeCode: row.leave_type_code as string,
      leaveTypeName: row.leave_type_name as string,
      minimumEntitlement: (row.minimum_entitlement as number) ?? 0,
      unit: row.unit as string,
      carryoverAllowed: (row.carryover_allowed as boolean) ?? false,
      maxCarryover: (row.max_carryover as number) ?? 0,
      effectiveFrom: row.effective_from ? new Date(row.effective_from as string) : new Date(),
      status: row.status as StatutoryLeaveType['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
