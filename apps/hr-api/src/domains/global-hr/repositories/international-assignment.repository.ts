import { Injectable } from '@nestjs/common';
import { type ColumnType, Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { InternationalAssignment } from '../aggregates/international-assignment.aggregate.js';

interface InternationalAssignmentsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  home_country: string;
  host_country: string;
  legal_entity_id: string | null;
  start_date: Date;
  end_date: Date;
  assignment_reason: string;
  status: string;
  aggregate_version: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

type GlobalHrDatabase = Database & {
  'hr_global_hr.international_assignments': InternationalAssignmentsTable;
};

@Injectable()
export class InternationalAssignmentRepository {
  private readonly db: Kysely<GlobalHrDatabase>;

  constructor() {
    this.db = createKyselyInstance(getPool()) as Kysely<GlobalHrDatabase>;
  }

  async findById(id: Uuid): Promise<InternationalAssignment | undefined> {
    const row = await this.db
      .selectFrom('hr_global_hr.international_assignments')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<InternationalAssignment[]> {
    const rows = await this.db
      .selectFrom('hr_global_hr.international_assignments')
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .execute();
    return rows.map((row: any) => this.toAggregate(row));
  }

  async findByTenant(tenantId: Uuid): Promise<InternationalAssignment[]> {
    const rows = await this.db
      .selectFrom('hr_global_hr.international_assignments')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((row: any) => this.toAggregate(row));
  }

  async save(entity: InternationalAssignment): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_global_hr.international_assignments')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      home_country: entity.homeCountry,
      host_country: entity.hostCountry,
      legal_entity_id: entity.legalEntityId?.value ?? null,
      start_date: entity.startDate,
      end_date: entity.endDate,
      assignment_reason: entity.assignmentReason,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_global_hr.international_assignments')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_global_hr.international_assignments')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): InternationalAssignment {
    return new InternationalAssignment({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      workerId: new Uuid(row.worker_id as string),
      homeCountry: row.home_country as string,
      hostCountry: row.host_country as string,
      legalEntityId: row.legal_entity_id ? new Uuid(row.legal_entity_id as string) : undefined,
      startDate: new Date(row.start_date as string),
      endDate: new Date(row.end_date as string),
      assignmentReason: row.assignment_reason as string,
      status: row.status as InternationalAssignment['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
