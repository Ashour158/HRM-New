import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { EmployeeRelationsCase, type EmployeeRelationsCaseStatus } from '../aggregates/employee-relations-case.aggregate.js';

@Injectable()
export class EmployeeRelationsCaseRepository extends BaseRepository<'employee_relations_cases', EmployeeRelationsCase> {
  protected readonly tableName = 'employee_relations_cases' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<EmployeeRelationsCase | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['employee_relations_cases']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<EmployeeRelationsCase[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['employee_relations_cases']));
  }

  async findBySubjectWorker(subjectWorkerId: Uuid): Promise<EmployeeRelationsCase[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('subject_worker_id', '=', subjectWorkerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['employee_relations_cases']));
  }



  async save(entity: EmployeeRelationsCase): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['employee_relations_cases']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['employee_relations_cases']>);
    }
  }

  private toAggregate(row: Database['employee_relations_cases']): EmployeeRelationsCase {
    return new EmployeeRelationsCase({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      caseNumber: row.case_number,
      subjectWorkerId: new Uuid(row.subject_worker_id),
      caseType: row.case_type,
      severity: 'LOW',
      description: '',
      openedBy: new Uuid(row.subject_worker_id),
      assignedTo: row.assigned_to ? new Uuid(row.assigned_to) : undefined,
      status: row.status as EmployeeRelationsCaseStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: EmployeeRelationsCase): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      subject_worker_id: entity.subjectWorkerId.value,
      manager_id: entity.assignedTo?.value ?? null,
      case_number: entity.caseNumber,
      case_type: entity.caseType,
      status: entity.status,
      opened_at: entity.createdAt ?? new Date(),
      assigned_to: entity.assignedTo?.value ?? null,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
