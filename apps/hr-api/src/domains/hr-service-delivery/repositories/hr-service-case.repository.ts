import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { HrServiceCase, type HrServiceCaseStatus } from '../aggregates/hr-service-case.aggregate.js';

@Injectable()
export class HrServiceCaseRepository extends BaseRepository<'hr_service_cases', HrServiceCase> {
  protected readonly tableName = 'hr_service_cases' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<HrServiceCase | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['hr_service_cases']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<HrServiceCase[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['hr_service_cases']));
  }

  async findByRequester(tenantId: Uuid, requesterWorkerId: Uuid): Promise<HrServiceCase[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('requester_worker_id', '=', requesterWorkerId.value)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['hr_service_cases']));
  }



  async save(entity: HrServiceCase): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['hr_service_cases']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['hr_service_cases']>);
    }
  }

  private toAggregate(row: Database['hr_service_cases']): HrServiceCase {
    return new HrServiceCase({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      requesterWorkerId: new Uuid(row.requester_worker_id),
      caseNumber: row.case_number,
      caseType: row.case_type,
      priority: row.priority,
      description: row.description,
      assignedTo: row.assigned_to ? new Uuid(row.assigned_to) : undefined,
      slaDeadline: row.sla_deadline ?? undefined,
      resolvedAt: row.resolved_at ?? undefined,
      status: row.status as HrServiceCaseStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: HrServiceCase): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      requester_worker_id: entity.requesterWorkerId.value,
      case_number: entity.caseNumber,
      case_type: entity.caseType,
      priority: entity.priority,
      description: entity.description,
      status: entity.status,
      assigned_to: entity.assignedTo?.value ?? null,
      sla_deadline: entity.slaDeadline ?? null,
      resolved_at: entity.resolvedAt ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
